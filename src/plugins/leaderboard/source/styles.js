import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBarTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  podiumContainer: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  podiumItem: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  podiumItemFirst: {
    marginBottom: 20,
  },
  podiumItemSecond: {
    marginBottom: 0,
  },
  podiumItemThird: {
    marginBottom: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarRingFirst: {
    borderColor: '#FFB800',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarRingSecond: {
    borderColor: '#FFD700',
  },
  avatarRingThird: {
    borderColor: '#FFD700',
  },
  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#e0e0e0',
  },
  avatarCircleFirst: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  rankBadgeFirst: {
    backgroundColor: '#b8e986',
  },
  rankBadgeSecond: {
    backgroundColor: '#b8e986',
  },
  rankBadgeThird: {
    backgroundColor: '#b8e986',
  },
  rankBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a2c2a',
  },
  podiumName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  podiumPoints: {
    fontSize: 14,
    color: '#666666',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  currentUserItem: {
    backgroundColor: '#4a2c2a',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    width: 30,
  },
  currentUserRankNumber: {
    color: '#ffffff',
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 15,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserAvatar: {
    backgroundColor: '#ffffff',
  },
  listUserInfo: {
    flex: 1,
    marginLeft: 15,
  },
  listUserName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  currentUserName: {
    color: '#ffffff',
  },
  listUserLabel: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  listPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  currentUserPoints: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
  },
  poweredByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  poweredByText: {
    fontSize: 14,
    color: '#501F16',
  },
});

