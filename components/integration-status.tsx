'use client'

import React from 'react';
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle } from "lucide-react"

interface IntegrationStatusProps {
  name: string;
  isConnected: boolean;
  onConnect: () => void;
}

export function IntegrationStatus({ name, isConnected, onConnect }: IntegrationStatusProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
      <div className="flex items-center space-x-4">
        {isConnected ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <XCircle className="w-6 h-6 text-red-500" />
        )}
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className={isConnected ? "text-green-600" : "text-red-600"}>
            {isConnected ? 'Connected' : 'Not connected'}
          </p>
        </div>
      </div>
      {!isConnected && (
        <Button onClick={onConnect} variant="outline">
          Connect {name}
        </Button>
      )}
    </div>
  );
}