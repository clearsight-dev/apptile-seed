import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import {border, buttons, layout, text} from '../styles';
import {
  DownloadCodepushCb,
  DownloadNonCacheCodepushCb,
  HomeState,
} from '../types/type';
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

const HomeCard = ({
  state,
  onDownload,
  onNonCacheDownload,
  onModalDismiss,
  onRefresh,
  onScan,
}: HomeCardProps) => {
  if (state.appId) {
    return (
      <SafeAreaView>
        <ScrollView style={[layout.flexCol, layout.p2]}>
          <View style={[layout.flexRow, layout.justifyBetween]}>
            <Text style={text.secondary}>{state.appId}</Text>
            <Pressable onPress={onRefresh} style={buttons.primary}>
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
        <LauncSequenceModal state={state} onModalDismiss={onModalDismiss} />
      </SafeAreaView>
    );
  } else {
    return (
      <SafeAreaView
        style={[
          layout.flexCol,
          layout.alignCenter,
          layout.justifyCenter,
          styles.safeArea,
        ]}>
        <View style={styles.cardContainer}>
          <Image
            style={styles.logo}
            resizeMode="contain"
            source={require('../assets/logo.png')}
          />
          <Text style={styles.welcomeText}>Welcome to Apptile Preview lol</Text>
          <Pressable style={styles.scanButton} onPress={onScan}>
            <Image
              source={require('../assets/qr-icon.png')}
              style={styles.qrIcon}
            />
            <Text style={styles.scanButtonText}>Scan your Project</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  cardContainer: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    margin: 24,
    width: '90%',
  },
  logo: {
    height: 55,
    marginBottom: 85,
  },
  welcomeText: {
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Circular Std',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    marginBottom: 23,
    marginTop: 30,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 188,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1060E0',
  },
  qrIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  scanButtonText: {
    color: '#FFF',
    textAlign: 'center',
    fontFamily: 'Circular Std',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
  },
});

export default HomeCard;
