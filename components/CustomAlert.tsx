import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { useTheme } from '../app/theme-context';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
  onClose: () => void;
  showSpinner?: boolean; // Nova propriedade
}

const CustomAlert: React.FC<CustomAlertProps> = ({ 
  visible, 
  title, 
  message, 
  buttons, 
  onClose,
  showSpinner = false // Valor padrão
}) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  console.log("CustomAlert rendered with visible:", visible);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={() => {
        console.log("Modal overlay pressed, closing alert");
        onClose();
      }}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.alertContainer,
              isDark ? styles.darkAlert : styles.lightAlert
            ]}>
              <Text style={[
                styles.title,
                isDark ? styles.darkText : styles.lightText
              ]}>
                {title}
              </Text>

              <Text style={[
                styles.message,
                isDark ? styles.darkText : styles.lightText
              ]}>
                {message}
              </Text>
              
              {/* Spinner de carregamento */}
              {showSpinner && (
                <ActivityIndicator 
                  size="large" 
                  color="#0a7ea4" 
                  style={styles.spinner}
                />
              )}

              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => {
                  console.log("Rendering button:", button.text);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        button.style === 'destructive' ? styles.destructiveButton :
                        button.text === "PDF" ? styles.redButton :
                        button.text === "CSV (Excel)" ? styles.greenButton :
                        button.text === "JSON (Para importar na app)" ? styles.yellowButton :
                        isDark ? styles.darkButton : styles.lightButton,
                        index === buttons.length - 1 && styles.lastButton
                      ]}
                      onPress={() => {
                        console.log("Button pressed:", button.text);
                        button.onPress();
                        onClose();
                      }}
                    >
                      <Text style={[
                        styles.buttonText,
                        button.style === 'destructive' ? styles.destructiveText :
                        (isDark ? styles.darkButtonText : styles.lightButtonText)
                      ]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: Dimensions.get('window').width * 0.85,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  darkAlert: {
    backgroundColor: '#333',
  },
  lightAlert: {
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#000',
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  destructiveButton: {
    backgroundColor: '#e74c3c',
  },
  redButton: {
    backgroundColor: '#c0392b',
  },
  greenButton: {
    backgroundColor: '#27ae60',
  },
  yellowButton: {
    backgroundColor: '#f39c12',
  },
  darkButton: {
    backgroundColor: '#444',
  },
  lightButton: {
    backgroundColor: '#f0f0f0',
  },
  lastButton: {
    marginBottom: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  darkButtonText: {
    color: '#fff',
  },
  lightButtonText: {
    color: '#000',
  },
  destructiveText: {
    color: '#fff',
  },
  // Novo estilo para o spinner
  spinner: {
    marginBottom: 20,
  },
});

export default CustomAlert;
