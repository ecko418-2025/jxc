import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';

let message: MessageInstance = {} as any;
let notification: NotificationInstance = {} as any;
let modal: Omit<ModalStaticFunctions, 'warn'> = {} as any;

// A list of fallback methods that log warning or call console until initialized
const methods = ['info', 'success', 'error', 'warning', 'loading', 'open'];
methods.forEach(method => {
  (message as any)[method] = (...args: any[]) => {
    console.warn(`static message.${method} called before AntdApp initialized.`);
    // Fallback to console
    if (method === 'error') console.error(...args);
    else if (method === 'warning') console.warn(...args);
    else console.log(...args);
  };
});

export const AntdStaticExtractor: React.FC = () => {
  const staticFunction = App.useApp();
  message = staticFunction.message;
  notification = staticFunction.notification;
  modal = staticFunction.modal;
  return null;
};

export { message, notification, modal };
