import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  clearAll: () => {},
});

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [myId, setMyId] = useState(null);
  const channelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setMyId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!myId) return;

    // Önceki kanalı temizle
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications-${myId}`)
      // Birisinin maçına katılması (organizer için)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_players',
      }, async (payload) => {
        if (payload.new.user_id === myId) return; // Kendi katılımı
        // O maçın organizatörü miyim?
        const { data: m } = await supabase
          .from('matches')
          .select('organizer_id, format, venues(name)')
          .eq('id', payload.new.match_id)
          .single();
        if (!m || m.organizer_id !== myId) return;
        // Katılan kişinin adını al
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', payload.new.user_id)
          .single();
        addNotification({
          id: `mp-${Date.now()}`,
          type: 'join',
          icon: '⚽',
          title: 'Maçına Katıldı',
          body: `${prof?.full_name || 'Bir oyuncu'} ${m.venues?.name || m.format} maçına katıldı`,
          matchId: payload.new.match_id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      })
      // Maç daveti
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_invites',
        filter: `to_user=eq.${myId}`,
      }, async (payload) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', payload.new.from_user)
          .single();
        addNotification({
          id: `inv-${Date.now()}`,
          type: 'invite',
          icon: '🤝',
          title: 'Maç Daveti',
          body: `${prof?.full_name || 'Bir oyuncu'} seni maça davet etti`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [myId]);

  function addNotification(n) {
    setNotifications(prev => [n, ...prev].slice(0, 50));
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearAll() {
    setNotifications([]);
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
