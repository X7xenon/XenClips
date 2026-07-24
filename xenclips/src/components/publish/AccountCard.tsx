import { Trash2, Star, CheckCircle2 } from "lucide-react";
import type { Account } from "@/lib/publish-store";
import { PlatformBadge } from "./PlatformBadge";

interface AccountCardProps {
  account: Account;
  onRemove: (id: string) => void;
  onSetDefault: (id: string, platform: Account["platform"]) => void;
}

export function AccountCard({ account, onRemove, onSetDefault }: AccountCardProps) {
  return (
    <div className="glass-panel p-4 flex items-center justify-between group relative overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.2)]">
      {account.isDefault && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[rgba(0,240,255,0.2)] to-transparent opacity-50 pointer-events-none rounded-bl-full" />
      )}

      <div className="flex items-center gap-4">
        <div className="relative">
          {account.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt={account.username}
              className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(255,255,255,0.1)]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(255,255,255,0.1)] flex items-center justify-center text-lg font-bold text-gray-400 uppercase">
              {account.username.charAt(0)}
            </div>
          )}
          {account.isDefault && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center text-[#00F0FF]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-white text-base">{account.username}</span>
            {account.isDefault && (
              <span className="text-[9px] font-display uppercase tracking-widest font-bold text-[#00F0FF] bg-[rgba(0,240,255,0.1)] px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
          </div>
          <PlatformBadge platform={account.platform} />
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!account.isDefault && (
          <button
            onClick={() => onSetDefault(account.id, account.platform)}
            className="p-2 rounded-lg text-gray-400 hover:text-[#00F0FF] hover:bg-[rgba(0,240,255,0.1)] transition-colors"
            title="Set as Default"
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onRemove(account.id)}
          className="p-2 rounded-lg text-gray-400 hover:text-[#FF2A5F] hover:bg-[rgba(255,42,95,0.1)] transition-colors"
          title="Remove Account"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
