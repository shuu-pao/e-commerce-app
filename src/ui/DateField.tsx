import { useState } from 'react';

import { isDateKey } from '@/domain/dates';

import { Field } from './Field';

interface Props {
  label: string;
  value: string;
  onChange: (key: string) => void;
}

/** A day as YYYY-MM-DD. The web build uses the browser's date picker instead (DateField.web.tsx). */
export function DateField({ label, value, onChange }: Props) {
  const [text, setText] = useState(value);
  return (
    <Field
      label={label}
      value={text}
      placeholder="YYYY-MM-DD"
      onChangeText={(t) => {
        setText(t);
        if (isDateKey(t)) onChange(t);
      }}
      error={text && !isDateKey(text) ? 'Use YYYY-MM-DD' : null}
    />
  );
}
