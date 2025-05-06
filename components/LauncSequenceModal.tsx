import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { HomeState } from '../types/type';
import RNRestart from 'react-native-restart';
import { SvgXml } from 'react-native-svg';

const checkIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#4BB543"/><path d="M6 10.5L9 13.5L14 8.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const errorIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#FF2D1A"/><path d="M7 7L13 13M13 7L7 13" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`;
const pendingIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#B0B0B0"/><circle cx="10" cy="10" r="5" fill="white"/></svg>`;

const LauncSequenceModal = (props: { state: HomeState, onModalDismiss: () => void }) => {
    const { state, onModalDismiss } = props;
    const anyInProgress = state.launchSequence.some(item => item.status === 'inprogress');
    const sequenceComplete = state.launchSequence.length > 0 && state.launchSequence.every(item => item.status === 'success');

    const actionItems = state.launchSequence.map(item => {
        let statusIndicator = null;
        if (item.status === 'inprogress') {
            statusIndicator = <ActivityIndicator size="small" color="#1060E0" />
        } else if (item.status === 'success') {
            statusIndicator = <SvgXml xml={checkIcon} width={20} height={20} />;
        } else if (item.status === 'error') {
            statusIndicator = <SvgXml xml={errorIcon} width={20} height={20} />;
        } else {
            statusIndicator = <SvgXml xml={pendingIcon} width={20} height={20} />;
        }
        return (
            <View
                key={item.label}
                style={styles.stepRow}
            >
                {statusIndicator}
                <Text style={styles.stepLabel}>{item.label}</Text>
            </View>
        );
    });

    return (
        <Modal
            visible={state.showLaunchSequence}
            animationType={'slide'}
            presentationStyle={'pageSheet'}
            onRequestClose={onModalDismiss}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>Download Progress</Text>
                    <Pressable onPress={onModalDismiss} hitSlop={10} style={styles.closeBtn}>
                        <Text style={styles.closeText}>Close</Text>
                    </Pressable>
                </View>
                <View style={styles.stepsContainer}>
                    {actionItems}
                </View>
                {anyInProgress && (
                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${(state.launchSequence.filter(i => i.status === 'success').length / state.launchSequence.length) * 100}%` }]} />
                        </View>
                        <Text style={styles.progressText}>Downloading...</Text>
                    </View>
                )}
                {sequenceComplete && (
                    <Pressable style={styles.restartBtn} onPress={() => RNRestart.Restart()}>
                        <Text style={styles.restartBtnText}>Restart App</Text>
                    </Pressable>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.00)',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        paddingTop: 48,
        paddingHorizontal: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#222',
    },
    closeBtn: {
        padding: 4,
    },
    closeText: {
        color: '#1060E0',
        fontSize: 16,
        fontWeight: '600',
    },
    stepsContainer: {
        marginBottom: 18,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepLabel: {
        fontSize: 16,
        color: '#222',
        marginLeft: 12,
    },
    progressBarContainer: {
        marginBottom: 18,
        alignItems: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressBarFill: {
        height: 8,
        backgroundColor: '#1060E0',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#1060E0',
        fontWeight: '500',
    },
    restartBtn: {
        backgroundColor: '#295DDB',
        borderRadius: 32,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    restartBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LauncSequenceModal;