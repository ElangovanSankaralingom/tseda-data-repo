"use client";

import { useState } from "react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import type { SelectDropdownOption } from "@/lib/types/ui";

export default function SearchCategorySelect({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: readonly SelectDropdownOption[];
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <SelectDropdown
      name={name}
      value={value}
      onChange={setValue}
      options={options}
      placeholder={placeholder}
    />
  );
}
