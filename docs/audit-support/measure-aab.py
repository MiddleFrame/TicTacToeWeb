import argparse
import json
import re
import struct
import sys
import zipfile

sys.dont_write_bytecode = True

from android_audit_common import input_path, repository_root, sha256_bytes, sha256_file, work_output, write_json


DEX_SUM_KEYS = ('bytes', 'classDefinitions', 'methodDefinitions', 'methodIdsIncludingReferences', 'fieldIdsIncludingReferences')


def read_uleb128(data, position):
    result = 0
    for shift in range(0, 35, 7):
        if position >= len(data):
            raise ValueError('Truncated DEX ULEB128')
        byte = data[position]
        position += 1
        if shift == 28 and byte > 15:
            raise ValueError('DEX ULEB128 exceeds 32 bits')
        result |= (byte & 127) << shift
        if byte < 128:
            return result, position
    raise ValueError('Invalid DEX ULEB128')


def dex_statistics(data):
    version = data[4:7]
    if len(data) < 112 or data[:4] != b'dex\n' or data[7:8] != b'\0':
        raise ValueError('Invalid DEX header')
    if version not in (b'035', b'037', b'038', b'039', b'040'):
        raise ValueError('Unsupported DEX version/container; versions 035 and 037-040 are supported')
    u32 = lambda position: struct.unpack_from('<I', data, position)[0]
    if u32(32) != len(data) or u32(36) != 112 or u32(40) != 0x12345678:
        raise ValueError('Unsupported DEX header size, file size or endianness')
    classes, class_offset = u32(96), u32(100)
    if class_offset + classes * 32 > len(data):
        raise ValueError('DEX class definitions exceed file bounds')
    methods = 0
    for index in range(classes):
        position = u32(class_offset + index * 32 + 24)
        if position == 0:
            continue
        sizes = []
        for _ in range(4):
            value, position = read_uleb128(data, position)
            sizes.append(value)
        methods += sizes[2] + sizes[3]
    return {
        'version': version.decode('ascii'),
        'bytes': len(data),
        'sha256': sha256_bytes(data),
        'classDefinitions': classes,
        'methodDefinitions': methods,
        'methodIdsIncludingReferences': u32(88),
        'fieldIdsIncludingReferences': u32(80),
    }


def elf_statistics(data):
    if len(data) < 52 or data[:4] != b'\x7fELF' or data[4] not in (1, 2) or data[5] not in (1, 2):
        raise ValueError('Unsupported ELF header')
    endian = '<' if data[5] == 1 else '>'
    if data[4] == 2:
        if len(data) < 64:
            raise ValueError('Truncated ELF64 header')
        offset = struct.unpack_from(endian + 'Q', data, 32)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 54)
        layout = endian + 'IIQQQQQQ'
        file_offset_index, address_index = 2, 3
    else:
        offset = struct.unpack_from(endian + 'I', data, 28)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 42)
        layout = endian + 'IIIIIIII'
        file_offset_index, address_index = 1, 2
    if count == 65535 or size < struct.calcsize(layout) or offset + count * size > len(data):
        raise ValueError('Unsupported or truncated ELF program headers')
    segments = []
    for index in range(count):
        header = struct.unpack_from(layout, data, offset + index * size)
        if header[0] == 1:
            segments.append({
                'alignment': header[7],
                'fileOffset': header[file_offset_index],
                'virtualAddress': header[address_index],
                'offsetAddressCongruentAt16KiB': header[file_offset_index] % 16384 == header[address_index] % 16384,
            })
    return {
        'elfBits': 64 if data[4] == 2 else 32,
        'loadSegmentAlignments': [segment['alignment'] for segment in segments],
        'loadSegments': segments,
        'allLoadSegmentsAtLeast16KiB': bool(segments) and all(segment['alignment'] >= 16384 for segment in segments),
        'allLoadOffsetsCongruentAt16KiB': bool(segments) and all(segment['offsetAddressCongruentAt16KiB'] for segment in segments),
    }


def totals(entries):
    return {key: sum(entry[key] for entry in entries.values()) for key in DEX_SUM_KEYS}


def read_small_entry(archive, name, maximum):
    if name not in archive.namelist():
        return None
    info = archive.getinfo(name)
    if info.file_size > maximum:
        raise ValueError('Unexpectedly large build metadata entry')
    return archive.read(info)


def measure(source):
    dex, embedded_dex, native, mapping = {}, {}, {}, {}
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len({entry.filename for entry in entries}) != len(entries):
            raise ValueError('Duplicate ZIP member names are not supported')
        for entry in entries:
            if entry.is_dir():
                continue
            with archive.open(entry) as member:
                magic = member.read(8)
            if magic.startswith(b'dex\n'):
                result = {**dex_statistics(archive.read(entry)), 'compressedBytes': entry.compress_size}
                target = dex if re.fullmatch(r'[^/]+/dex/[^/]+\.dex', entry.filename) else embedded_dex
                target[entry.filename] = result
            elif entry.filename.endswith('.dex') or magic.startswith(b'cdex'):
                raise ValueError('A packaged DEX is not a supported standard DEX container')
            if magic.startswith(b'\x7fELF'):
                data = archive.read(entry)
                native[entry.filename] = {
                    'bytes': entry.file_size,
                    'compressedBytes': entry.compress_size,
                    'sha256': sha256_bytes(data),
                    **elf_statistics(data),
                }
            elif re.fullmatch(r'[^/]+/lib/[^/]+/[^/]+\.so', entry.filename):
                raise ValueError('A packaged native library has no ELF header')
            if entry.filename.startswith('BUNDLE-METADATA/') and ('mapping' in entry.filename.casefold() or 'proguard' in entry.filename.casefold()):
                mapping[entry.filename] = {'bytes': entry.file_size, 'compressedBytes': entry.compress_size}
        r8_bytes = read_small_entry(archive, 'BUNDLE-METADATA/com.android.tools/r8.json', 1024 * 1024)
        if r8_bytes is None:
            raise ValueError('The AAB has no embedded R8 metadata')
        r8 = json.loads(r8_bytes)
        coverage = {}
        for category in ('optimization', 'obfuscation', 'shrinking'):
            no_percentage = r8.get('stats', {}).get('no' + category.capitalize() + 'Percentage')
            if not isinstance(no_percentage, (int, float)) or isinstance(no_percentage, bool) or not 0 <= no_percentage <= 100:
                raise ValueError('Missing or invalid R8 coverage metadata')
            coverage[category] = round(100 - no_percentage, 8)
        metadata = {}
        properties = read_small_entry(archive, 'BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties', 65536)
        if properties:
            for line in properties.decode('utf-8').splitlines():
                key, separator, value = line.partition('=')
                if separator and key.strip() == 'androidGradlePluginVersion':
                    metadata[key.strip()] = value.strip()
    combined = {**dex, **embedded_dex}
    return {
        'schemaVersion': 1,
        'inputFilename': source.name,
        'aabBytes': source.stat().st_size,
        'aabSha256': sha256_file(source),
        'zipEntries': len(entries),
        'zipCompressedEntryBytes': sum(entry.compress_size for entry in entries),
        'zipUncompressedEntryBytes': sum(entry.file_size for entry in entries),
        'r8Version': r8.get('version'),
        'coverage': coverage,
        'r8Metadata': r8,
        'buildMetadata': metadata,
        'dex': dex,
        'dexCount': len(dex),
        'dexTotals': totals(dex),
        'embeddedDex': embedded_dex,
        'allPackagedDexCount': len(combined),
        'allPackagedDexTotals': totals(combined),
        'native': native,
        'nativeCount': len(native),
        'nativeBytes': sum(entry['bytes'] for entry in native.values()),
        'allNativeLoadSegmentsAtLeast16KiB': bool(native) and all(entry['allLoadSegmentsAtLeast16KiB'] for entry in native.values()),
        'mappingMetadata': mapping,
        'limitations': [
            'DEX discovery checks raw member headers, including assets; nested archives and compact/version-041 containers are not decoded.',
            'Method definitions use encoded direct/virtual method counts; method-ID slots include references and are not deduplicated across DEX files.',
            'ELF segment alignment does not validate generated APK ZIP alignment, signing, Play processing or runtime behavior.',
            'Archive bytes and R8 coverage do not measure Play device download size, startup, CPU, memory or stability.',
            'Manifest values, application identifiers and asset contents are not included in this report.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description='Read an explicit release AAB and write sanitized Android measurements under ignored work')
    parser.add_argument('--aab', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--repo-root')
    args = parser.parse_args()
    root = repository_root(args.repo_root)
    source = input_path(root, args.aab)
    target = work_output(root, args.output)
    if source.suffix.casefold() != '.aab' or not source.is_file() or target.suffix.casefold() != '.json' or source == target:
        raise ValueError('Expected an existing .aab input and a separate .json output under work')
    result = measure(source)
    write_json(target, result)
    print(json.dumps({key: result[key] for key in ('aabBytes', 'aabSha256', 'r8Version', 'coverage', 'dexTotals', 'allPackagedDexTotals', 'nativeCount', 'nativeBytes', 'allNativeLoadSegmentsAtLeast16KiB')}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, struct.error, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
