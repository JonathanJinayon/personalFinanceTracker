import type { Metadata } from "next";
import { SettingsPage as SettingsPageView } from "@/features/settings/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsPageView />;
}
