public final class RoomConstructorProbe {
    public static void main(String[] args) {
        boolean failed = false;
        for (String name : args) {
            try {
                Class<?> type = Class.forName(name);
                Object instance = type.getDeclaredConstructor().newInstance();
                System.out.println("PASS " + instance.getClass().getName());
            } catch (Throwable error) {
                failed = true;
                System.out.println("FAIL " + name + " " + error.getClass().getName());
                Throwable cause = error.getCause();
                while (cause != null) {
                    System.out.println("CAUSE " + cause.getClass().getName());
                    cause = cause.getCause();
                }
            }
        }
        System.exit(failed ? 1 : 0);
    }
}
