import React from 'react';
import { Text, View } from 'react-native';
import { border, layout, text } from '../styles';
import { HomeState } from '../types/type';

const ScheduledOTA = (props: { manifest: HomeState['manifest'] }) => {
    const manifest = props.manifest;

    let renderedVersions = (
        <View>
            <Text>No versions yet!</Text>
        </View>
    );

    return (
        <View
            style={[layout.flexCol, border.solid, border.round1, layout.p1, layout.mTopBottom]}
        >
            <Text style={[text.subtitle]}>Versions</Text>
            {renderedVersions}
        </View>
    );
}

export default ScheduledOTA