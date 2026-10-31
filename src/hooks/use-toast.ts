export function useToast() {
  return {
    toast: (config: any) => {
      console.log('Toast:', config);
    },
  };
}

export function toast(config: any) {
  console.log('Toast:', config);
}

