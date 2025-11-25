import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
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
  languageSelector: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  languageText: {
    fontSize: 16,
    color: '#000000',
    marginRight: 8,
  },
  logoContainer: {
    marginTop: 80,
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4a2c2a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a2c2a',
  },
  inputSection: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  inputLabel: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    fontSize: 16,
    color: '#000000',
    padding: 0,
  },
  button: {
    backgroundColor: '#4a2c2a',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#4a2c2a',
  },
  poweredByContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  poweredByText: {
    fontSize: 20,
    color: '#501F16',
    marginBottom: 5,
  },
});

