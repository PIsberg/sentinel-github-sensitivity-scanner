
import RuleList from "@/components/admin/RuleList";
import ConfigSettings from "@/components/admin/ConfigSettings";

export default function AdminPage() {
    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration</h1>
                <p className="text-gray-500">Manage security rules and scanner settings.</p>
            </div>

            <ConfigSettings />

            <RuleList />
        </main>
    );
}
