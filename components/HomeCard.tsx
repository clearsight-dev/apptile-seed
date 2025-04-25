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
      <SafeAreaView
        style={[
          layout.flexCol,
          layout.alignCenter,
          layout.p2
        ]}
      >
        <Image
          style={{
            height: 100
          }}
          resizeMode={'contain'}
          source={require('../assets/logo.png')}
        />
        <View
          style={[layout.mTopBottom]}
        >
          <Text>Scan your QR code to see your app's versions</Text>
        </View>
        <Pressable
          style={{
            borderRadius: 16,
            backgroundColor: '#1060E0',
            minWidth: 80,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
            marginTop: 40
          }}
        >
          <Text
            style={[text.large, { color: 'white' }]}
            onPress={onScan}
          >
            Scan
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

export default HomeCard