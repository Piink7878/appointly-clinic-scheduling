export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
  });
};

