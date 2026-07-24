import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Key,
  Users,
  Settings2,
  Plus,
  Sparkles,
  Youtube,
  Instagram,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { usePublishStore, type Platform } from "@/lib/publish-store";
import { AccountCard } from "@/components/publish/AccountCard";

export const Route = createFileRoute("/accounts")({
  component: AccountsManager,
});

function AccountsManager() {
  const {
    accounts,
    addAccount,
    removeAccount,
    setDefaultAccount,
    secrets,
    updateSecrets,
    aiKeys,
    addAIKey,
    removeAIKey,
  } = usePublishStore();

  const [newAiKey, setNewAiKey] = useState("");
  const [newAiProvider, setNewAiProvider] = useState<"gemini" | "openrouter">("openrouter");

  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("youtube");

  const [localSecrets, setLocalSecrets] = useState(secrets);
  const [secretsSaved, setSecretsSaved] = useState(false);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    addAccount({
      platform: newPlatform,
      username: newUsername,
      isDefault: false,
    });
    setNewUsername("");
  };

  const [aiKeyError, setAiKeyError] = useState(false);

  const handleAddAiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAiKey.trim()) {
      // Trigger shake animation to signal the field is required
      setAiKeyError(true);
      setTimeout(() => setAiKeyError(false), 600);
      return;
    }
    addAIKey({ provider: newAiProvider, key: newAiKey.trim() });
    setNewAiKey("");
  };

  const handleSaveSecrets = () => {
    updateSecrets(localSecrets);
    setSecretsSaved(true);
    setTimeout(() => setSecretsSaved(false), 2000);
  };

  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-10">
        <h1 className="font-display text-[2.5rem] font-bold tracking-tight mb-2 text-white flex items-center gap-3">
          <Users className="w-8 h-8 text-[#8A2BE2]" />
          Account <span className="text-gradient">Manager</span>
        </h1>
        <p className="text-gray-400 text-sm">
          Manage social platforms, API keys, and developer credentials.
        </p>
      </div>

      <div className="space-y-8">
        {/* Social Accounts */}
        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#00F0FF]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              Publishing Accounts
            </h2>
          </div>

          <div className="p-6">
            <form
              onSubmit={handleAddAccount}
              className="flex flex-col sm:flex-row items-end gap-4 mb-8"
            >
              <div className="flex-1 w-full">
                <label className="label-section !mb-2 block">Platform</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as Platform)}
                  className="w-full"
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="label-section !mb-2 block">Username / Channel</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={!newUsername.trim()}
                className="btn-primary w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" /> Add Account
              </button>
            </form>

            {accounts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                No accounts configured. Add one above to start publishing.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    onRemove={removeAccount}
                    onSetDefault={setDefaultAccount}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Developer Secrets */}
        <div className="glass-panel overflow-hidden border-[#FF2A5F]/20">
          <div className="px-6 py-4 border-b border-[#FF2A5F]/10 bg-[rgba(255,42,95,0.02)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF2A5F]/10 border border-[#FF2A5F]/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#FF2A5F]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-[#FF2A5F]">
              OAuth Credentials
            </h2>
          </div>

          <div className="p-6 bg-[rgba(20,20,25,0.4)]">
            <p className="text-xs text-gray-400 mb-6 max-w-2xl leading-relaxed">
              To upload directly to YouTube and Instagram, you must provide your own API
              credentials. These are stored locally and never sent to our servers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
              <div className="space-y-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-[#FF0000]" /> YouTube API
                </h3>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client ID</label>
                  <input
                    type="text"
                    value={localSecrets.youtubeClientId || ""}
                    onChange={(e) =>
                      setLocalSecrets({ ...localSecrets, youtubeClientId: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                    placeholder="xxx.apps.googleusercontent.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client Secret</label>
                  <input
                    type="password"
                    value={localSecrets.youtubeClientSecret || ""}
                    onChange={(e) =>
                      setLocalSecrets({ ...localSecrets, youtubeClientSecret: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                    placeholder="GOCSPX-..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-[#E1306C]" /> Instagram Graph API
                </h3>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client ID</label>
                  <input
                    type="text"
                    value={localSecrets.instagramClientId || ""}
                    onChange={(e) =>
                      setLocalSecrets({ ...localSecrets, instagramClientId: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                    placeholder="App ID"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client Secret</label>
                  <input
                    type="password"
                    value={localSecrets.instagramClientSecret || ""}
                    onChange={(e) =>
                      setLocalSecrets({ ...localSecrets, instagramClientSecret: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                    placeholder="App Secret"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-white/5 pt-4">
              <button
                onClick={handleSaveSecrets}
                className="btn-outline !text-[#FF2A5F] !border-[#FF2A5F]/50 hover:!bg-[#FF2A5F]/10"
              >
                <Settings2 className="w-4 h-4" /> Save Credentials
              </button>
              {secretsSaved && (
                <span className="text-xs text-[#00F0FF] font-bold tracking-widest uppercase animate-fade-in-up">
                  Saved Securely
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Metadata Keys */}
        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(138,43,226,0.1)] border border-[rgba(138,43,226,0.2)] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#8A2BE2]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              AI Metadata Providers
            </h2>
          </div>

          <div className="p-6 bg-[rgba(20,20,25,0.2)]">
            <p className="text-xs text-gray-400 mb-6 max-w-2xl">
              Add API keys for AI providers to automatically generate viral titles, captions, and
              hashtags. The system will try them in order and fallback if one fails.
            </p>

            <form
              onSubmit={handleAddAiKey}
              className="flex flex-col sm:flex-row items-end gap-4 mb-6 max-w-3xl"
            >
              <div className="w-48 shrink-0">
                <label className="label-section !mb-2 block">Provider</label>
                <select
                  value={newAiProvider}
                  onChange={(e) => setNewAiProvider(e.target.value as any)}
                  className="w-full"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="label-section !mb-2 block">API Key</label>
                <input
                  type="password"
                  value={newAiKey}
                  onChange={(e) => {
                    setNewAiKey(e.target.value);
                    setAiKeyError(false);
                  }}
                  placeholder="sk-..."
                  className={`w-full font-mono text-xs transition-all ${
                    aiKeyError
                      ? "border-[#FF2A5F] shadow-[0_0_0_3px_rgba(255,42,95,0.25)] animate-shake"
                      : ""
                  }`}
                />
                {aiKeyError && (
                  <p className="text-[#FF2A5F] text-[11px] mt-1 font-medium animate-fade-in-up">
                    Please enter an API key first.
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="btn-outline !border-[#8A2BE2]/50 text-[#D68AFF] hover:!bg-[#8A2BE2]/10 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" /> Add Key
              </button>
            </form>

            <div className="max-w-3xl space-y-2">
              {aiKeys.length === 0 ? (
                <div className="text-xs text-gray-500 italic">
                  No AI keys configured. Metadata will fallback to basic templates.
                </div>
              ) : (
                aiKeys.map((k, idx) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-center text-xs text-gray-600 font-mono">
                        {idx + 1}.
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white capitalize">
                          {k.provider}
                        </div>
                        <div className="text-xs font-mono text-gray-500 mt-0.5">
                          {k.key.substring(0, 4)}...{k.key.substring(k.key.length - 4)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAIKey(k.id)}
                      className="p-1.5 text-gray-500 hover:text-[#FF2A5F] hover:bg-[#FF2A5F]/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
