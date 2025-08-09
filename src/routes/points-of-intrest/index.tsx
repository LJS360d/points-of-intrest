import { createFileRoute } from "@tanstack/solid-router";
import clsx from "clsx";
import Konva from 'konva';
import { FaSolidDownload, FaSolidMapPin, FaSolidTrash, FaSolidUpload } from 'solid-icons/fa';
import { createEffect, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";

export const Route = createFileRoute("/points-of-intrest/")({
  component: App,
});

type Pin = {
  id: string;
  x: number;
  y: number;
  color: string;
  konvaNode?: Konva.Circle;
};

interface AppStore {
  activeTool: 'none' | 'pin';
  pinColor: string;
  backgroundImage: HTMLImageElement | null;
  pins: Pin[];
}

const [store, setStore] = createStore<AppStore>({
  activeTool: 'none',
  pinColor: "#FF0000",
  backgroundImage: null,
  pins: [],
});

function ToolPanel() {
  return (
    <section class="w-full h-full bg-base-100 max-w-64 flex flex-col items-center p-4 gap-4 rounded-lg shadow-xl">
      <h2 class="text-xl font-bold">Drawing Tools</h2>
      <div class="flex flex-col gap-2 w-full">
        <button
          class={clsx("btn btn-info w-full", store.activeTool === 'pin' && "btn-active")}
          onClick={() => setStore(produce(s => { s.activeTool = 'pin'; }))}
        >
          <FaSolidMapPin class="w-5 h-5" /> Pin Tool
        </button>
        <button
          class={clsx("btn btn-error w-full", store.activeTool === 'none' && "btn-active")}
          onClick={() => setStore(produce(s => { s.activeTool = 'none'; }))}
        >
          Disable Tool
        </button>
      </div>
      <div class="divider">Color</div>
      <label class="form-control w-full">
        <div class="label">
          <span class="label-text">Pin Color</span>
        </div>
        <input
          type="color"
          value={store.pinColor}
          onInput={(e) => setStore(produce(s => { s.pinColor = e.currentTarget.value; }))}
          class="input input-bordered w-full h-10"
        />
      </label>
    </section>
  );
}

function CanvasViewport() {
  let viewportEl: HTMLDivElement | undefined;
  let canvasContainerEl: HTMLDivElement | undefined;
  let stage: Konva.Stage | undefined;
  let layer: Konva.Layer | undefined;
  let backgroundImageNode: Konva.Image | undefined;

  const checkerboardPatternImage = new Image();
  checkerboardPatternImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAOUlEQVQ4y2NgoBAwMjAwMDAwMDAw/g9lYGBggH/+/gdjMzMzGBmYmZmRloEBAQYGYmRkZGBgoGNgYAAAE0rWw5k8M7IAAAAASUVORK5CYII=';

  onMount(() => {
    if (!canvasContainerEl || !viewportEl) return;

    stage = new Konva.Stage({
      container: canvasContainerEl,
      width: viewportEl.clientWidth,
      height: viewportEl.clientHeight,
    });
    layer = new Konva.Layer();
    stage.add(layer);

    backgroundImageNode = new Konva.Image({
      x: 0,
      y: 0,
      image: checkerboardPatternImage,
      width: checkerboardPatternImage.width,
      height: checkerboardPatternImage.height,
      listening: false,
    });
    layer.add(backgroundImageNode);

    fitImageToView(checkerboardPatternImage);

    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const scaleBy = 1.1;
      const oldScale = layer!.scaleX();
      const pointer = stage!.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - layer!.x()) / oldScale,
        y: (pointer.y - layer!.y()) / oldScale,
      };

      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      layer!.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      layer!.position(newPos);
      layer!.batchDraw();
    });

    stage.on('mousedown', (e) => {
      if (store.activeTool === 'pin') {
        const pointerPosition = layer!.getRelativePointerPosition();
        if (pointerPosition) {
          addPin(pointerPosition.x, pointerPosition.y, store.pinColor);
        }
      } else {
        layer?.draggable(true);
      }
    });

    stage.on('mouseup', () => {
      layer?.draggable(false);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (stage && viewportEl) {
        stage.width(viewportEl.clientWidth);
        stage.height(viewportEl.clientHeight);
        fitImageToView(store.backgroundImage || checkerboardPatternImage);
      }
    });
    resizeObserver.observe(viewportEl);

    onCleanup(() => {
      stage?.destroy();
      resizeObserver.disconnect();
    });
  });

  createEffect(() => {
    const img = store.backgroundImage;
    if (backgroundImageNode) {
      if (img) {
        backgroundImageNode.image(img);
        backgroundImageNode.width(img.naturalWidth);
        backgroundImageNode.height(img.naturalHeight);
        fitImageToView(img);
      } else {
        backgroundImageNode.image(checkerboardPatternImage);
        backgroundImageNode.width(checkerboardPatternImage.width);
        backgroundImageNode.height(checkerboardPatternImage.height);
        fitImageToView(checkerboardPatternImage);
      }
      layer?.batchDraw();
    }
  });

  createEffect(() => {
    if (!layer) return;

    const currentPinIds = new Set(store.pins.map(p => p.id));
    layer.find('.pin').forEach(node => {
      if (!currentPinIds.has(node.id())) {
        node.destroy();
      }
    });

    store.pins.forEach(pin => {
      if (!layer!.findOne(`#${pin.id}`)) {
        const pinNode = new Konva.Circle({
          x: pin.x,
          y: pin.y,
          radius: 8,
          fill: pin.color,
          stroke: "black",
          strokeWidth: 1,
          id: pin.id,
          name: 'pin',
        });

        const textNode = new Konva.Text({
          x: pin.x,
          y: pin.y,
          text: pin.id.split('-')[1],
          fontSize: 10,
          fill: 'white',
          align: 'center',
          verticalAlign: 'middle',
        });
        textNode.offsetX(textNode.width() / 2);
        textNode.offsetY(textNode.height() / 2);

        pinNode.on('dblclick', () => {
          removePin(pin.id);
        });

        layer!.add(pinNode, textNode);
      }
    });

    layer.batchDraw();
  });

  const fitImageToView = (img: HTMLImageElement) => {
    if (!stage || !layer) return;

    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    const stageAspectRatio = stageWidth / stageHeight;

    let scale = 1;
    let x = 0;
    let y = 0;

    if (imageAspectRatio > stageAspectRatio) {
      scale = stageWidth / img.naturalWidth;
      y = (stageHeight - img.naturalHeight * scale) / 2;
    } else {
      scale = stageHeight / img.naturalHeight;
      x = (stageWidth - img.naturalWidth * scale) / 2;
    }

    scale = Math.min(scale, 1);

    layer.scale({ x: scale, y: scale });
    layer.position({ x: x, y: y });
    layer.batchDraw();
  };

  const addPin = (x: number, y: number, color: string) => {
    const newPin: Pin = { id: `pin-${store.pins.length + 1}`, x, y, color };
    setStore(produce(s => { s.pins.push(newPin); }));
  };

  const removePin = (pinId: string) => {
    setStore(produce(s => {
      s.pins = s.pins.filter(p => p.id !== pinId);
    }));
  };

  const handleImageFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setStore(produce(s => { s.backgroundImage = img; }));
      };
      img.src = imageUrl;
    }
  };

  return (
    <section ref={viewportEl} class="flex-1 h-full max-w-[calc(100svw-560px)] shadow-2xl overflow-hidden relative rounded-lg">
      <div ref={canvasContainerEl} class="absolute inset-0 w-full h-full cursor-grab" />
    </section>
  );
}

function UtilityPanel() {
  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file.type.startsWith("image/")) {
          const imageUrl = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            setStore(produce(s => { s.backgroundImage = img; }));
          };
          img.src = imageUrl;
        }
      }
    };
    input.click();
  };

  const handleClearAll = () => {
    setStore(produce(s => {
      s.backgroundImage = null;
      s.pins = [];
    }));
  };

  const handleExportImage = () => {
    const stage = Konva.stages[0];
    if (!stage) return;
    const dataURL = stage.toDataURL({
      mimeType: 'image/png',
      quality: 1,
    });
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'edited_map.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <section class="w-full h-full bg-base-100 max-w-64 flex flex-col items-center p-4 gap-4 rounded-lg shadow-xl">
      <h2 class="text-xl font-bold">Image Tools</h2>
      <button class="btn btn-primary w-full" onClick={handleUploadClick}>
        <FaSolidUpload class="w-5 h-5" /> Upload Image
      </button>
      <div class="divider">Canvas Actions</div>
      <button class="btn btn-warning w-full" onClick={handleClearAll}>
        <FaSolidTrash class="w-5 h-5" /> Clear All
      </button>
      <button class="btn btn-success w-full" onClick={handleExportImage}>
        <FaSolidDownload class="w-5 h-5" /> Export Image (PNG)
      </button>
    </section>
  );
}

function App() {
  return (
    <main class="h-svh w-svw relative bg-base-300 p-2 sm:p-4 md:p-8 flex items-center justify-center overflow-hidden gap-2">
      <ToolPanel />
      <CanvasViewport />
      <UtilityPanel />
    </main>
  );
}