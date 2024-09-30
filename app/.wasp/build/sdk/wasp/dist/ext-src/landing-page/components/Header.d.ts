interface NavigationItem {
    name: string;
    href: string;
}
export default function Header({ navigation }: {
    navigation: NavigationItem[];
}): import("react").JSX.Element;
export {};
