/**
 * 공유 타입 정의
 * 모든 컴포넌트/서비스에서 import해서 사용
 */

// AssetCard, AssetType → src/store/projectStore.ts에서 export됨

export interface Scene {
  id: string;
  text: string;
  location: string;
  cameraAngle: string;
  imageUrl: string;
  characters: string[];
  status: 'pending' | 'generating' | 'done';
  checked: boolean;
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  type: 'video' | 'audio' | 'sfx';
  label: string;
  duration: number; // seconds
}

export type AspectRatio = '16:9' | '9:16' | '1:1';
