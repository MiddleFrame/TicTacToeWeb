import argparse
import copy
import json
import re
import sys

sys.dont_write_bytecode = True

from android_audit_common import input_path, repository_root, sha256_file, work_output, write_json


def mediator(adapter):
    return 'applovin' if adapter.startswith('applovin-') else adapter


def validate(profile, catalog):
    enabled = profile.get('enabled')
    disabled = profile.get('disabledRoutes')
    networks = catalog.get('networks')
    if not isinstance(enabled, list) or not isinstance(disabled, list) or not isinstance(networks, dict):
        raise ValueError('Invalid source profile/catalog structure')
    if not all(isinstance(name, str) and re.fullmatch(r'[a-z0-9-]+', name) for name in enabled):
        raise ValueError('Invalid network name')
    if len(set(enabled)) != len(enabled) or not {'admob', 'applovin'} <= set(enabled) or not set(enabled) <= set(networks):
        raise ValueError('The source profile must satisfy the current production network checks')
    for route in disabled:
        if not isinstance(route, str) or len(route.split(':')) != 2:
            raise ValueError('Invalid disabled route')
        network, adapter = route.split(':')
        if network not in enabled or mediator(adapter) not in enabled or adapter not in networks[network]:
            raise ValueError('Disabled route is not present in the selected catalog')


def main():
    parser = argparse.ArgumentParser(description='Generate temporary leave-one-network-out MAS profiles under ignored work; does not run builds')
    parser.add_argument('--source-profile', default='android-config/mas-networks.json')
    parser.add_argument('--catalog', default='android-config/mas-network-catalog.json')
    parser.add_argument('--output-dir', default='work/technical-audit-2026-09-07/repro/profiles')
    parser.add_argument('--repo-root')
    args = parser.parse_args()
    root = repository_root(args.repo_root)
    source = input_path(root, args.source_profile)
    catalog_path = input_path(root, args.catalog)
    folder = work_output(root, args.output_dir)
    profile = json.loads(source.read_text(encoding='utf-8-sig'))
    catalog = json.loads(catalog_path.read_text(encoding='utf-8-sig'))
    validate(profile, catalog)
    variants = []
    for removed in profile['enabled']:
        variant = copy.deepcopy(profile)
        variant['enabled'] = [network for network in profile['enabled'] if network != removed]
        selected = set(variant['enabled'])
        variant['disabledRoutes'] = [route for route in profile['disabledRoutes'] if route.split(':')[0] in selected and mediator(route.split(':')[1]) in selected]
        filename = 'without-' + removed + '/profile.json'
        write_json(folder / filename, variant)
        variants.append({
            'removed': removed,
            'relativeProfile': filename,
            'enabled': variant['enabled'],
            'disabledRoutes': variant['disabledRoutes'],
            'passesMandatoryNetworkValidation': removed not in ('admob', 'applovin'),
            'note': 'Project validation must reject this diagnostic profile; do not bypass it' if removed in ('admob', 'applovin') else 'Build outcome and final resolved routes must be measured; generation is not compatibility approval',
        })
    write_json(folder / 'baseline-profile.json', profile)
    index = {
        'sdkVersion': catalog.get('sdkVersion'),
        'sourceProfileSha256': sha256_file(source),
        'catalogSha256': sha256_file(catalog_path),
        'variantCount': len(variants),
        'variants': variants,
        'buildsExecuted': False,
    }
    write_json(folder / 'index.json', index)
    print(json.dumps({'variantCount': len(variants), 'mandatoryNetworkExclusions': ['admob', 'applovin'], 'buildsExecuted': False}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
