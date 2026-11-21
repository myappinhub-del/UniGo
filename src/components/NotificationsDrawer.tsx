import React from 'react';
import { Bell, Check, X } from 'lucide-react';
import { NotificationItem } from '../types/unigo';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  notifications,
  onMarkRead,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl border-l border-neutral-200 flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#16A34A]" />
            <h3 className="text-base font-bold text-[#222222]">Notifications</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#222222]">
                You are all caught up
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Order confirmations, ride updates, and offers appear here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 transition-colors ${
                  n.read ? 'bg-white' : 'bg-[#16A34A]/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-[#222222]">
                    {n.title}
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="text-[11px] font-medium text-[#16A34A] hover:underline shrink-0 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark read</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  {n.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
