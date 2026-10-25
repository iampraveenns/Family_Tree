import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, UserPlus, Sparkles, Heart, Clock, X } from 'lucide-react';
import { useCollaborationStore } from '../../stores/useCollaborationStore.ts';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { NotificationItem } from '../../types/index.ts';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { currentFamily, activeFamilyId } = useFamilyStore();
  const {
    notifications,
    unreadNotificationCount,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useCollaborationStore();

  const familyId = currentFamily?.id || activeFamilyId;

  // Poll for notifications
  useEffect(() => {
    if (!familyId) return;
    fetchNotifications(familyId);
    const interval = setInterval(() => {
      fetchNotifications(familyId);
    }, 12000);
    return () => clearInterval(interval);
  }, [familyId, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen && familyId) {
      fetchNotifications(familyId);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!familyId) return;
    await markNotificationRead(familyId, notificationId);
  };

  const handleMarkAllAsRead = async () => {
    if (!familyId) return;
    await markAllNotificationsRead(familyId);
  };

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'MEMBER_ADDED':
        return <UserPlus className="w-3.5 h-3.5 text-[#2563EB]" />;
      case 'MEMORY_ADDED':
      case 'NEW_CONTRIBUTION':
        return <Sparkles className="w-3.5 h-3.5 text-amber-600" />;
      case 'RELATIONSHIP_UPDATED':
        return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[#2563EB]" />;
    }
  };

  return (
    <div className="relative z-[9999] overflow-visible" ref={containerRef}>
      {/* Bell Icon Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="View notifications"
        aria-expanded={isOpen}
        title="Family notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer bg-white"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in-75">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown with Highest Priority Stacking Context */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#CBD5E1] shadow-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-xs font-bold text-[#0F172A] tracking-tight">
                Notifications
              </h3>
              {unreadNotificationCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#2563EB]">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#F1F5F9]">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#0F172A]">No notifications yet</p>
                <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs mx-auto">
                  You will receive alerts here when family relatives are added or memories are shared.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const notifId = n.id || (n as any)._id;
                return (
                  <div
                    key={notifId}
                    onClick={() => {
                      if (!n.isRead) {
                        handleMarkAsRead(notifId);
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[#F8FAFC] ${
                      !n.isRead ? 'bg-blue-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#CBD5E1] shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
                      {getIconForType(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${!n.isRead ? 'font-bold text-[#0F172A]' : 'font-medium text-slate-700'}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
                        )}
                      </div>

                      <p className="text-[11.5px] text-[#475569] mt-0.5 leading-snug">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(n.createdAt)}</span>
                        {n.actorName && (
                          <>
                            <span>•</span>
                            <span className="truncate">by {n.actorName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
