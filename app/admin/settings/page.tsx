import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { Settings, Mail, User, Shield } from "lucide-react";

export const metadata = {
  title: "Settings | CertiGen",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Account and application settings.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            Profile
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{session.user.email}</p>
            </div>
          </div>
          {session.user.name && (
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {(session.user as { role?: string }).role ?? "admin"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Application
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Version</p>
              <p className="text-xs text-gray-500">CertiGen</p>
            </div>
            <span className="text-sm text-gray-500">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Authentication</p>
              <p className="text-xs text-gray-500">Google OAuth</p>
            </div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
