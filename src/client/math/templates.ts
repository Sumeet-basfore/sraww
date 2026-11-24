export interface TemplateBox {
  x: number;
  y: number;
  width: number;
}

export interface AxesBox extends TemplateBox {
  height: number;
  step?: number;
}

export interface NumberLineBox extends TemplateBox {
  step?: number;
}

export interface TableBox extends TemplateBox {
  height: number;
  rows?: number;
  cols?: number;
}

interface LineSkeleton {
  type: 'line';
  x: number;
  y: number;
  points: [number, number][];
  endArrowhead?: 'arrow';
}

interface TextSkeleton {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: number;
}

export type MathSkeleton = LineSkeleton | TextSkeleton;

function line(x: number, y: number, dx: number, dy: number, arrow = false): LineSkeleton {
  return {
    type: 'line',
    x,
    y,
    points: [
      [0, 0],
      [dx, dy],
    ],
    ...(arrow ? { endArrowhead: 'arrow' as const } : {}),
  };
}

function positiveStep(step: number | undefined, fallback: number): number {
  return step && Number.isFinite(step) && step > 0 ? step : fallback;
}

export function axesSkeleton({ x, y, width, height, step }: AxesBox): MathSkeleton[] {
  const unit = positiveStep(step, 40);
  const centerX = width / 2;
  const centerY = height / 2;
  const items: MathSkeleton[] = [
    {
      type: 'line',
      x,
      y,
      points: [
        [centerX, height],
        [centerX, 0],
      ],
      endArrowhead: 'arrow',
    },
    line(x, y + centerY, width, 0, true),
  ];

  for (let offset = unit; offset < centerX; offset += unit) {
    items.push(line(x + centerX - offset, y + centerY - 4, 0, 8));
    items.push(line(x + centerX + offset, y + centerY - 4, 0, 8));
  }
  for (let offset = unit; offset < centerY; offset += unit) {
    items.push(line(x + centerX - 4, y + centerY - offset, 8, 0));
    items.push(line(x + centerX - 4, y + centerY + offset, 8, 0));
  }

  return items;
}

export function numberLineSkeleton({ x, y, width, step }: NumberLineBox): MathSkeleton[] {
  const unit = positiveStep(step, 50);
  const divisions = Math.floor(width / unit);
  const items: MathSkeleton[] = [line(x, y + 20, width, 0, true)];

  for (let index = 0; index <= divisions; index += 1) {
    const markX = x + index * unit;
    items.push(line(markX, y + 14, 0, 12));
    items.push({
      type: 'text',
      x: markX - 4,
      y: y + 32,
      text: String(index),
      fontSize: 16,
      fontFamily: 2,
    });
  }

  return items;
}

export function tableSkeleton({
  x,
  y,
  width,
  height,
  rows = 3,
  cols = 3,
}: TableBox): MathSkeleton[] {
  const items: MathSkeleton[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const lineY = y + (height * row) / rows;
    items.push(line(x, lineY, width, 0));
  }
  for (let col = 0; col <= cols; col += 1) {
    const lineX = x + (width * col) / cols;
    items.push(line(lineX, y, 0, height));
  }
  return items;
}
