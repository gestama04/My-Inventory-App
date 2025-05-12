import React, { useState, useCallback } from 'react';
import CustomAlert from '../components/CustomAlert';

interface AlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

const useCustomAlert = () => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);
  const [showSpinner, setShowSpinner] = useState(false); // Novo estado

  const showAlert = useCallback((
    alertTitle: string,
    alertMessage: string,
    alertButtons: AlertButton[],
    alertShowSpinner: boolean = false // Novo parâmetro com valor padrão
  ) => {
    setTitle(alertTitle);
    setMessage(alertMessage);
    setButtons(alertButtons);
    setShowSpinner(alertShowSpinner); // Definir o estado do spinner
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const AlertComponent = useCallback(() => (
    <CustomAlert
      visible={visible}
      title={title}
      message={message}
      buttons={buttons}
      onClose={hideAlert}
      showSpinner={showSpinner} // Passar o estado do spinner
    />
  ), [visible, title, message, buttons, hideAlert, showSpinner]);

  return {
    showAlert,
    AlertComponent
  };
};

export default useCustomAlert;
