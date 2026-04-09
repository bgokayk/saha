import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
  clearAll: () => {},
  checkMatchReminders: () => {},
});

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [myId, setMyId] = useState(null);
  const channelRef = useRef(null);
  const reminderCheckedRef = useRef(new Set());

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
        try {
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
            id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'match_joined',
            icon: '⚽',
            title: 'Maçına Katıldı',
            body: `${prof?.full_name || 'Bir oyuncu'} ${m.venues?.name || m.format} maçına katıldı`,
            matchId: payload.new.match_id,
            read: false,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      })
      // Başvuru alındı (organizer için) — match_applications INSERT
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_applications',
      }, async (payload) => {
        if (payload.new.user_id === myId) return; // Kendi başvurusu
        try {
          const { data: m } = await supabase
            .from('matches')
            .select('organizer_id, venues(name)')
            .eq('id', payload.new.match_id)
            .single();
          if (!m || m.organizer_id !== myId) return;
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.user_id)
            .single();
          addNotification({
            id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'application',
            icon: '⚡',
            title: 'Yeni Başvuru',
            body: `${prof?.full_name || 'Bir oyuncu'} maçına başvurdu`,
            matchId: payload.new.match_id,
            read: false,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      })
      // Başvuru kabul edildi (başvuran için) — match_applications UPDATE
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_applications',
        filter: `user_id=eq.${myId}`,
      }, async (payload) => {
        if (payload.new.status !== 'accepted') return;
        try {
          addNotification({
            id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'accepted',
            icon: '✅',
            title: 'Başvurun Onaylandı!',
            body: 'Başvurun onaylandı! Maça eklendin',
            matchId: payload.new.match_id,
            read: false,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      })
      // Maç daveti
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_invites',
        filter: `to_user=eq.${myId}`,
      }, async (payload) => {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.from_user)
            .single();
          addNotification({
            id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'invite',
            icon: '👥',
            title: 'Maç Daveti',
            body: `${prof?.full_name || 'Bir oyuncu'} seni maça davet etti`,
            matchId: payload.new.match_id || null,
            read: false,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
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

  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function clearAll() {
    setNotifications([]);
  }

  // Kullanıcının katıldığı maçlar için 2 saatlik hatırlatma
  async function checkMatchReminders() {
    if (!myId) return;
    try {
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const { data: myMatches } = await supabase
        .from('match_players')
        .select('match_id, matches(id, match_date, format, venues(name))')
        .eq('user_id', myId);
      if (!myMatches) return;
      for (const row of myMatches) {
        const m = row.matches;
        if (!m || !m.match_date) continue;
        const matchTime = new Date(m.match_date);
        if (matchTime > now && matchTime <= twoHoursLater) {
          const key = `reminder-${m.id}`;
          if (reminderCheckedRef.current.has(key)) continue;
          reminderCheckedRef.current.add(key);
          addNotification({
            id: `${key}-${Date.now()}`,
            type: 'reminder',
            icon: '⏰',
            title: 'Maç Hatırlatıcı',
            body: `${m.venues?.name || m.format} maçın 2 saat içinde!`,
            matchId: m.id,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (_) {}
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, clearAll, checkMatchReminders }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
