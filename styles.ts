import {StyleSheet} from 'react-native';

const minSize = 16;

export const layout = StyleSheet.create({
  flexRow: {
    flexDirection: 'row'
  },
  flexCol: {
    flexDirection: 'column'
  },
  justifyBetween: {
    justifyContent: 'space-between'
  },
  justifyEnd: {
    justifyContent: 'flex-end'
  },
  justifyCenter: {
    justifyContent: 'center'
  },
  justifySpaceAround: {
    justifyContent: 'space-around'
  },
  justifySpaceEvenly: {
    justifyContent: 'space-evenly'
  },
  alignBaseline: {
    alignItems: 'baseline'
  },
  alignCenter: {
    alignItems: 'center'
  },
  p1: {
    padding: minSize * 0.5
  },
  p2: {
    padding: minSize
  },
  mTopBottom: {
    marginTop: minSize * 0.25,
    marginBottom: minSize * 0.25
  },
  mLeftRight: {
    marginLeft: minSize * 0.25,
    marginRight: minSize * 0.25
  },
  w5: {
    width: minSize * 5
  },
  w10: {
    width: minSize * 10
  },
  w25: {
    width: minSize * 25
  },
  w50: {
    width: minSize * 100
  },
  shrink: {
    flexShrink: 1
  },
  grow: {
    flexGrow: 1
  },
  fullWidth: {
    width: "100%"
  },
  fullHeight: {
    height: "100%"
  },
  maxW50: {
    maxWidth: "50%"
  },
  maxW25: {
    maxWidth: "25%"
  },
  minW50: {
    minWidth: "50%"
  },
  minW25: {
    minWidth: "25%"
  }
});

export const text = StyleSheet.create({
  body: {
    fontSize: 12
  },
  caption: {
    fontSize: 12,
    fontWeight: '100'
  },
  title: {
    fontSize: 30
  },
  subtitle: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  large: {
    fontSize: 16
  },
  primary: {
    color: '#000000',
  },
  secondary: {
    color: '#808080',
  },
  danger: {
    color: '#ff0000',
  },
  safe: {
    color: '#008000',
  },
  accent: {
    color: '#0373fc'
  }
    color: '#0373fc',
});

export const bgColor = StyleSheet.create({
  primary: {
    backgroundColor: '#000000',
  },
  secondary: {
    backgroundColor: '#808080',
  },
  danger: {
    backgroundColor: '#ff0000',
  },
  safe: {
    backgroundColor: 'green'
  }
    backgroundColor: '#008000',
});

export const border = StyleSheet.create({
  solid: {
    borderWidth: 1,
    borderColor: 'black'
  },
  round1: {
    borderRadius: minSize * 0.25
  }
});

export const buttons = StyleSheet.create({
  primary: {
    paddingLeft: 10,
    paddingRight: 10
  }
});
