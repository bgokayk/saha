import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';

const TYPE_ICONS = {
  match_joined: '⚽',
  application:  '⚡',
  accepted:     '✅',
  invite:       '👥',
  reminder:     '⏰',
  join:         '⚽',
};

function timeAgoShort(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 0) return 'Şimdi';
  if (m < 1) return 'Şimdi';
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();

  function handleNotifPress(n) {
    if (!n.read) markRead(n.id);
    const type = n.type;
    if ((type === 'application' || type === 'accepted' || type === 'match_joined' || type === 'join' || type === 'reminder') && n.matchId) {
      navigation.navigate('MatchDetail', { matchId: n.matchId });
    } else if (type === 'invite') {
      if (n.matchId) navigation.navigate('MatchDetail', { matchId: n.matchId });
      else navigation.navigate('Discover');
    }
    // Default: read only, no navigation
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
          )}
        </View>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markRead}>Okundu</Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Bildirim yok</Text>
          <Text style={styles.emptySub}>Maçına oyuncu katılınca burada görünür</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map(n => {
            const icon = n.icon || TYPE_ICONS[n.type] || '🔔';
            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.notifRow,
                  n.read ? styles.notifRowRead : styles.notifRowUnread,
                ]}
                onPress={() => handleNotifPress(n)}
                activeOpacity={0.8}
              >
                {!n.read && <View style={styles.unreadBorder} />}
                <View style={[styles.notifIconWrap, !n.read && styles.notifIconWrapUnread]}>
                  <Text style={styles.notifIcon}>{icon}</Text>
                </View>
                <View style={styles.notifBody}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifMsg} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.notifTime}>{timeAgoShort(n.createdAt)}</Text>
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => {
              Alert.alert(
                'Bildirimleri Temizle',
                'Tüm bildirimler silinecek. Emin misin?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Temizle', style: 'destructive', onPress: clearAll },
                ]
              );
            }}>
              <Text style={styles.clearBtnText}>Tümünü Temizle</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  header:    { backgroundColor: '#0A1628', paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.12)' },
  backText:  { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  badge:     { backgroundColor: '#FF4757', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markRead:  { color: '#00D4FF', fontSize: 13 },

  notifRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,212,255,0.08)', position: 'relative', overflow: 'hidden' },
  notifRowUnread:  { backgroundColor: '#0F1E35' },
  notifRowRead:    { backgroundColor: 'rgba(255,255,255,0.02)' },
  unreadBorder:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#00D4FF' },
  notifIconWrap:   { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  notifIconWrapUnread: { backgroundColor: 'rgba(0,212,255,0.12)' },
  notifIcon:       { fontSize: 20 },
  notifBody:       { flex: 1, gap: 3 },
  notifTitle:      { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  notifMsg:        { fontSize: 12, color: '#8B9BB4', lineHeight: 16 },
  notifTime:       { fontSize: 10, color: '#8B9BB4', marginTop: 2 },
  unreadDot:       { position: 'absolute', right: 12, top: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D4FF' },

  clearBtn:     { marginHorizontal: 16, marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,71,87,0.12)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,71,87,0.3)' },
  clearBtnText: { color: '#FF4757', fontSize: 13, fontWeight: '700' },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySub:   { fontSize: 13, color: '#8B9BB4', textAlign: 'center' },
});
