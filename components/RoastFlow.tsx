"use client";

import { useState } from "react";
import BirthForm from "./BirthForm";
import StreamingRoast from "./StreamingRoast";

interface FormData {
  name: string;
  email?: string;
  date: string;
  time?: string;
  city: string;
}

export default function RoastFlow() {
  const [formData, setFormData] = useState<FormData | null>(null);

  if (formData) {
    return <StreamingRoast formData={formData} />;
  }

  return <BirthForm onSubmit={setFormData} />;
}
