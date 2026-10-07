/**
 * Shared limits for every dropdown surface (Radix Popover / DropdownMenu content).
 *
 * - `collisionPadding`: stays 8px inside the window and flips side when there is no room.
 * - max height = the room Radix measured on the chosen side (capped), so a long list never
 *   runs off the screen; the list scrolls inside instead (`overscroll-contain`: the page
 *   behind doesn't scroll once the list reaches its end).
 * - max width = the window, minus a margin.
 *
 * Popovers that hold a scrolling list and can open from a drawer or dialog are `modal`:
 * otherwise the dialog's scroll lock swallows mouse-wheel events over the (portalled) list.
 */
export const DROPDOWN_COLLISION_PADDING = 8;

const surface = "z-50 rounded-lg border border-border bg-surface p-1.5 shadow-overlay max-w-[calc(100vw-16px)]";

/**
 * Popover content with its own scrolling list inside (search box + list): a flex column.
 * The var's fallback matters: Radix decides above / below before it has measured the room,
 * and without a fallback the list would be measured at its full height (hundreds of
 * options) and flip above the trigger even when 20rem fit below (20rem: the search box and about nine rows).
 */
export const popoverListSurface = `${surface} flex flex-col max-h-[min(var(--radix-popover-content-available-height,20rem),20rem)]`;

/** Popover content that scrolls as a whole (date range, small forms). */
export const popoverSurface = `${surface} overflow-y-auto overscroll-contain max-h-[var(--radix-popover-content-available-height)]`;

/** DropdownMenu content (action menus, columns, saved views): scrolls as a whole. */
export const menuSurface = `${surface} overflow-y-auto overscroll-contain max-h-[var(--radix-dropdown-menu-content-available-height)]`;

/** The scrolling list inside `popoverListSurface`. */
export const dropdownList = "min-h-0 flex-1 overflow-y-auto overscroll-contain";
