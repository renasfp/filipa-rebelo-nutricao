import { requireAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/booking/store";
import SettingsForm from "./SettingsForm";

export default async function DefinicoesPage() {
  await requireAdmin();
  const config = await getConfig();
  return (
    <>
      <h1 className="admin-title">Definições da agenda</h1>
      <SettingsForm initialConfig={config} />
    </>
  );
}
