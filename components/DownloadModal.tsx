import React from 'react';
import { Modal, Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  isDownloading?: boolean;
  failureMessage: string;
  infoText: string;
}

const downloadFailedIcon = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.56" stroke="#FF0000" stroke-width="0.88"/><path d="M12.1071 4.76944L11.6636 12.6736H10.333L9.87367 4.76944H12.1071ZM9.84199 14.9546C9.84199 14.321 10.3489 13.7824 10.9825 13.7824C11.6319 13.7824 12.1546 14.321 12.1546 14.9546C12.1546 15.5882 11.6319 16.1109 10.9825 16.1109C10.3489 16.1109 9.84199 15.5882 9.84199 14.9546Z" fill="#FF0000"/></svg>`;
const infoIcon = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10.56" stroke="#1060E0" stroke-width="0.88"/><path d="M11 7.5V11.5M11 14.5H11.01" stroke="#1060E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const DownloadModal: React.FC<DownloadModalProps> = ({ visible, onClose, isDownloading, failureMessage, infoText }) => {
  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}>
        <Pressable
          style={styles.overlay}
          onPress={onClose}>
          <Pressable
            style={styles.modalContent}
            onPress={e => e.stopPropagation()}>
            {isDownloading && !failureMessage && (
              <>
                <ActivityIndicator size="large" style={styles.loader} />
                <Text style={styles.title}>Downloading...</Text>
              </>
            )}
            {failureMessage && (
              <>
                <SvgXml xml={downloadFailedIcon} width={22} height={22} />
                <Text style={styles.title}>Download Failed</Text>
                <Text style={styles.failureMessage}>{failureMessage}</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 220,
  },
  loader: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20
  },
  failedIcon: {
    fontSize: 32,
    color: 'red',
    marginBottom: 16,
  },
  failureMessage: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 15
  },
});

export default DownloadModal; 