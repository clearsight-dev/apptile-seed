import moment from 'moment';

export const getFormattedDate = (date: string) => {
  return moment(date).format('DD MMM, (hh:mm A) ');
};

export const sendToast = (message:string, toast:any) =>{
  toast.show(message,{
    placement: 'top',
    type:'info'
  });
}