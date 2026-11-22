import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

// 自绘下拉：替代原生 <select> 的系统弹出列表（Windows 下是直角灰底、无法套 token）。
// 浮层 portal 到 body + fixed 定位，避免被 composer 的 overflow 裁掉；
// 空间不足时自动向上展开（工作台输入区贴底，绝大多数时候是向上）。

export type ChipSelectOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  /** 触发按钮上显示的内容，缺省用 label */
  triggerLabel?: ReactNode;
  /** 选项第二行的说明 */
  hint?: ReactNode;
  /** 右侧附加信息（成功率等） */
  meta?: ReactNode;
  /** 左侧图形 */
  leading?: ReactNode;
  disabled?: boolean;
  /** 键入字母跳转用的纯文本 */
  textValue?: string;
};

type ChipSelectProps<T extends string | number> = {
  value: T;
  options: ChipSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  /** 触发按钮 class：胶囊用 param-chip，表单字段用 chip-select-field */
  className?: string;
  title?: string;
  /** 浮层顶部的小标题 */
  menuTitle?: ReactNode;
  menuMinWidth?: number;
};

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MENU_MAX_HEIGHT = 360;

export function ChipSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "请选择",
  disabled = false,
  className = "param-chip",
  title,
  menuTitle,
  menuMinWidth = 180,
}: ChipSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ text: "", at: 0 });
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const firstEnabledFrom = useCallback(
    (start: number, step: 1 | -1) => {
      if (options.length === 0) return -1;
      let index = start;
      for (let i = 0; i < options.length; i += 1) {
        index = (index + options.length) % options.length;
        if (!options[index].disabled) return index;
        index += step;
      }
      return -1;
    },
    [options],
  );

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    setMenuStyle({ visibility: "hidden" });
    setActiveIndex(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : firstEnabledFrom(0, 1));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close(true);
  };

  // 定位：先隐身渲染量出浮层尺寸，再决定上/下展开与左右夹紧
  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, menuMinWidth);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const natural = Math.min(menu.scrollHeight, MENU_MAX_HEIGHT);
    const goUp = spaceBelow < natural && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, goUp ? spaceAbove : spaceBelow));
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
    setPlacement(goUp ? "top" : "bottom");
    setMenuStyle({
      left,
      minWidth: width,
      maxHeight,
      ...(goUp
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  }, [menuMinWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    position();
  }, [open, position]);

  // 定位完成（visibility 恢复）后再聚焦：visibility:hidden 的元素拿不到焦点，键盘操作会失效
  const positioned = open && menuStyle.visibility !== "hidden";
  useEffect(() => {
    if (positioned) menuRef.current?.focus({ preventScroll: true });
  }, [positioned]);

  // 外部点击 / 视口变化 / 外部滚动 → 收起
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // 高亮项滚入可视区
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => firstEnabledFrom(index + 1, 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => firstEnabledFrom(index < 0 ? options.length - 1 : index - 1, -1));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(firstEnabledFrom(0, 1));
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(firstEnabledFrom(options.length - 1, -1));
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        break;
    }
    // 键入字母跳转（与原生 select 行为一致）
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const buffer = now - typeaheadRef.current.at > 600 ? event.key : typeaheadRef.current.text + event.key;
      typeaheadRef.current = { text: buffer, at: now };
      const needle = buffer.toLowerCase();
      const match = options.findIndex(
        (option) => !option.disabled && (option.textValue ?? String(option.value)).toLowerCase().startsWith(needle),
      );
      if (match >= 0) setActiveIndex(match);
    }
  };

  const triggerContent = selected ? selected.triggerLabel ?? selected.label : placeholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`chip-select-trigger ${className} ${open ? "is-open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        {selected?.leading && <span className="chip-select-leading">{selected.leading}</span>}
        <span className={`chip-select-value ${selected ? "" : "is-placeholder"}`}>{triggerContent}</span>
        <ChevronDown size={12} className="chip-select-caret" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            tabIndex={-1}
            className="chip-select-menu"
            data-placement={placement}
            style={menuStyle}
            onKeyDown={onMenuKeyDown}
          >
            {menuTitle && <div className="chip-select-menu-title">{menuTitle}</div>}
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={String(option.value)}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  className={`chip-select-option ${index === activeIndex ? "is-active" : ""}`}
                  onPointerMove={() => {
                    if (!option.disabled && index !== activeIndex) setActiveIndex(index);
                  }}
                  onClick={() => commit(index)}
                >
                  {option.leading && <span className="chip-select-leading">{option.leading}</span>}
                  <span className="chip-select-option-body">
                    <span className="chip-select-option-label">{option.label}</span>
                    {option.hint && <span className="chip-select-option-hint">{option.hint}</span>}
                  </span>
                  {option.meta && <span className="chip-select-option-meta">{option.meta}</span>}
                  <span className="chip-select-check" aria-hidden="true">
                    {isSelected && <Check size={14} />}
                  </span>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

/** 宽高比小图形：按比例画一个描边矩形，最长边 14px */
export function AspectGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const valid = w > 0 && h > 0;
  const scale = valid ? 14 / Math.max(w, h) : 1;
  const width = valid ? Math.max(3, Math.round(w * scale)) : 12;
  const height = valid ? Math.max(3, Math.round(h * scale)) : 12;
  return (
    <span className="aspect-glyph" aria-hidden="true">
      <span style={{ width, height }} />
    </span>
  );
}
