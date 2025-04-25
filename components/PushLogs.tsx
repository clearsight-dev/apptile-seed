import React from 'react';
import { Button, Text, View } from 'react-native';
import { border, layout, text } from '../styles';
import { DownloadCodepushCb, HomeState } from '../types/type';

const formatter = Intl.DateTimeFormat("en-us", { dateStyle: 'long' })

const PushLogs = (props: { logs: HomeState['pushLogs'], onDownload: DownloadCodepushCb }) => {
    const pushLogs = props.logs;
    let renderedLogs;
    if (pushLogs.logs.length === 0) {
        renderedLogs = (<Text>No pushLogs found</Text>);
    } else {
        const prefix = 'Update due to OTA at';
        renderedLogs = (
            <>
                {pushLogs.logs.map((entry, i) => {
                    let comment;
                    if (entry.comment.startsWith(prefix)) {
                        const dateString = entry.comment.slice(prefix.length);
                        const formattedDate = formatter.format(new Date(dateString));
                        comment = formattedDate;
                    } else {
                        comment = entry.comment;
                    }

                    return (
                        <View
                            key={'pushlog-' + i}
                            style={[layout.flexRow, layout.alignCenter, layout.justifyBetween, { borderBottomWidth: 1 }]}
                        >
                            <Text style={[layout.minW25, layout.maxW25]}>
                                {comment}
                            </Text>
                            <View style={[layout.p1, layout.mLeftRight]}>
                                <Text>{entry.androidBundleId || "-"}</Text>
                            </View>
                            <View style={[layout.p1, layout.mLeftRight]}>
                                <Text>{entry.iosBundleId || "-"}</Text>
                            </View>
                            <View style={[layout.p1, layout.mLeftRight]}>
                                <Text>{entry.publishedCommitId || "-"}</Text>
                            </View>
                            <Button
                                title="Download"
                                onPress={() => props.onDownload(
                                    entry.publishedCommitId,
                                    entry.iosBundleId,
                                    entry.androidBundleId
                                )}
                            />
                        </View>
                    );
                })
                }
            </>
        );
    }
    return (
        <View style={[border.solid, border.round1, layout.p1, layout.mTopBottom]}>
            <Text style={[text.subtitle]}>History</Text>
            {renderedLogs}
        </View>
    );
}

export default PushLogs