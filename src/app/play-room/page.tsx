'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoomJSON } from '../../editor/editorStore';
import type { RoomRuntimeHandle } from '../../game/rooms/RoomRuntime';

const PREVIEW_SLOT = 'roomPreview';

export default function PlayRoomPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RoomRuntimeHandle | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    (async () => {
      const raw = localStorage.getItem(PREVIEW_SLOT);
      if (!raw) {
        setError('No room in preview slot. Go to /editor and click PLAY TEST.');
        return;
      }

      let json: RoomJSON;
      try {
        json = JSON.parse(raw) as RoomJSON;
      } catch {
        setError('Preview slot contains invalid JSON.');
        return;
      }

      setRoomName(json.name);

      const { createRoomRuntime } = await import('../../game/rooms/RoomRuntime');
      if (cancelled) return;

      try {
        const handle = await createRoomRuntime(container, json, {
          debug: true,
          onPromptChange: setPrompt,
        });
        if (cancelled) {
          handle.destroy();
          return;
        }
        runtimeRef.current = handle;
      } catch (e) {
        console.error(e);
        setError(`Runtime failed to start: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();

    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080810',
        color: '#aabbcc',
        fontFamily: 'monospace',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          background: '#0a0a14cc',
          borderBottom: '1px solid #1a2233',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: 11,
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#556677', textTransform: 'uppercase', letterSpacing: 2 }}>
          Room Preview
        </span>
        <span style={{ color: '#aabbcc', marginLeft: 12 }}>{roomName}</span>
        <span style={{ marginLeft: 'auto', color: '#334455' }}>
          WASD move · E interact
        </span>
      </div>

      {/* Interaction prompt */}
      {prompt && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d0d1acc',
            border: '1px solid #ffcc00',
            color: '#ffcc00',
            padding: '8px 16px',
            fontSize: 13,
            letterSpacing: 1,
            pointerEvents: 'none',
          }}
        >
          {prompt}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#080810ee',
          }}
        >
          <div
            style={{
              padding: 24,
              border: '1px solid #cc4444',
              color: '#ff8888',
              maxWidth: 400,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: '#cc4444',
                fontSize: 11,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              ROOM PREVIEW ERROR
            </div>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
