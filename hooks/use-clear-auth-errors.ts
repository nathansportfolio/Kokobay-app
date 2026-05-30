import { useCallback } from 'react';
import type { FieldValues, Path, UseFormClearErrors } from 'react-hook-form';

export function useClearAuthErrors<T extends FieldValues>(clearErrors: UseFormClearErrors<T>) {
  const bindTextChange = useCallback(
    <K extends Path<T>>(name: K, onChange: (value: string) => void) =>
      (value: string) => {
        clearErrors(name);
        clearErrors('root');
        onChange(value);
      },
    [clearErrors],
  );

  return { bindTextChange };
}
