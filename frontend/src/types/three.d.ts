/// <reference types="three" />
declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher } from 'three';
  export class OrbitControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    enabled: boolean;
    update(): boolean;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/controls/PointerLockControls' {
  import { Camera, EventDispatcher, Vector3 } from 'three';
  export class PointerLockControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    isLocked: boolean;
    connect(): void;
    disconnect(): void;
    dispose(): void;
    getObject(): Camera;
    getDirection(v: Vector3): Vector3;
    moveForward(distance: number): void;
    moveRight(distance: number): void;
    lock(): void;
    unlock(): void;
  }
} 