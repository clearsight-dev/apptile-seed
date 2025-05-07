import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { border, buttons, layout, text } from '../styles';
import { DownloadCodepushCb, DownloadNonCacheCodepushCb, HomeState } from '../types/type';
import LiveApp from './LiveApp';
import PushLogs from './PushLogs';
import LauncSequenceModal from './LauncSequenceModal';
import ScheduledOTA from './ScheduledOTA';

type HomeCardProps = {
  state: HomeState;
  onNonCacheDownload: DownloadNonCacheCodepushCb;
  onDownload: DownloadCodepushCb;
  onModalDismiss: () => void;
  onRefresh: () => void;
  onScan: () => void;
};

const HomeCard = ({ state, onDownload, onNonCacheDownload, onModalDismiss, onRefresh, onScan }: HomeCardProps) => {
  if (state.appId) {
    return (
      <SafeAreaView>
        <ScrollView style={[layout.flexCol, layout.p2]}>
          <View style={[layout.flexRow, layout.justifyBetween]}>
            <Text style={[text.secondary]}>{state.appId}</Text>
            <Pressable
              onPress={onRefresh}
              style={[buttons.primary]}
            >
              <Text style={[text.accent, text.large]}>Refresh</Text>
            </Pressable>
          </View>
          <LiveApp
            manifest={state.manifest}
            onDownload={onDownload}
            onNonCacheDownload={onNonCacheDownload}
          />
          <ScheduledOTA manifest={state.manifest} />
          <PushLogs logs={state.pushLogs} onDownload={onDownload} />
        </ScrollView>
        <LauncSequenceModal
          state={state}
          onModalDismiss={onModalDismiss}
        />
      </SafeAreaView>
    );
  } else {
    return (
      <SafeAreaView style={[layout.flexCol, layout.alignCenter, layout.justifyCenter, { flex: 1, backgroundColor: '#F6F8FB' }]}>
        <View style={{
          // backgroundColor: 'white',
          borderRadius: 24,
          padding: 32,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 4,
          margin: 24,
          width: '90%',
        }}>
          <Image
            style={{ height: 90, marginBottom: 16 }}
            resizeMode="contain"
            source={require('../assets/logo.png')}
          />
          <Text style={[{ fontWeight: 'bold', marginBottom: 8, marginTop: 30 }]}>
            Welcome to Apptile Preview
          </Text>
          <Text style={[{ color: '#6B7280', textAlign: 'center', marginBottom: 32 }]}>
            Scan your QR code to see your app
          </Text>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 20,
              backgroundColor: '#1060E0',
              minWidth: 120,
              justifyContent: 'center',
              paddingVertical: 14,
              paddingHorizontal: 32,
              shadowColor: '#1060E0',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 2,
            }}
            onPress={onScan}
          >
            <Image source={require('../assets/qr-icon.png')} style={{ width: 22, height: 22, marginRight: 10 }} />
            <Text style={[text.large, { color: 'white', fontWeight: '600' }]}>Scan QR Code</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

export default HomeCard