import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { buttons, layout, text } from '../styles';
import { HomeState } from '../types/type';
import RNRestart from 'react-native-restart';

const LauncSequenceModal = (props: { state: HomeState, onModalDismiss: () => void }) => {
    const { state, onModalDismiss } = props;
    const actionItems = state.launchSequence.map(item => {
        let statusIndicator = null;
        if (item.status === 'inprogress') {
            statusIndicator = <ActivityIndicator size="small" />
        } else if (item.status === 'success') {
            statusIndicator = <Text style={[text.safe, text.large]}>✓</Text>;
        } else if (item.status === 'error') {
            statusIndicator = <Text style={[text.danger, text.title]}>˟</Text>;
        } else {
            statusIndicator = <Text style={[text.danger, text.safe]}>䷄</Text>
        }
        return (
            <View
                key={item.label}
                style={[layout.flexRow, layout.alignCenter]}
            >
                {statusIndicator}
                <Text style={[text.body, layout.mLeftRight]}>{item.label}</Text>
            </View>
        );
    });

    let sequenceComplete = true;
    for (let i = 0; i < state.launchSequence.length; ++i) {
        sequenceComplete = sequenceComplete && state.launchSequence[i].status === 'success';
    }

    let restartButton = null;
    if (sequenceComplete) {
        restartButton = (
            <View
                style={[layout.p1, layout.fullWidth, layout.flexRow, layout.justifyCenter]}
            >
                <Pressable style={[buttons.primary]} onPress={() => RNRestart.Restart()}>
                    <Text style={[text.accent]}>Restart</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <Modal
            visible={state.showLaunchSequence}
            animationType={'slide'}
            presentationStyle={'pageSheet'}
            onRequestClose={onModalDismiss}
        >
            <View style={[layout.fullWidth, layout.fullHeight, layout.flexCol]}>
                <View style={[layout.flexRow, layout.justifyEnd, layout.fullWidth, layout.p1]}>
                    <Pressable
                        style={[buttons.primary]}
                        onPress={onModalDismiss}
                    >
                        <Text style={[text.large, text.accent]}>Close</Text>
                    </Pressable>
                </View>
                <View style={[layout.p1]}>
                    {actionItems}
                </View>
                {restartButton}
            </View>
        </Modal>
    );
}

export default LauncSequenceModal