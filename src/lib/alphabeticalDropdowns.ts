import React from "react";

const dropdownLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareDropdownLabels(left: string, right: string): number {
  return dropdownLabelCollator.compare(left.trim(), right.trim());
}

export function sortByDropdownLabel<T>(
  items: readonly T[],
  getLabel: (item: T) => string,
): T[] {
  return [...items].sort((left, right) =>
    compareDropdownLabels(getLabel(left), getLabel(right)),
  );
}

function isPinnedNativeOption(option: HTMLOptionElement): boolean {
  // Empty-value options are placeholders such as "Select a client". Keep
  // those at the top while alphabetizing the actual choices below them.
  return option.value === "";
}

export function sortNativeSelect(select: HTMLSelectElement): void {
  const options = Array.from(select.children).filter(
    (child): child is HTMLOptionElement => child instanceof HTMLOptionElement,
  );

  if (options.length < 2) return;

  const pinnedOptions = options.filter(isPinnedNativeOption);
  const sortableOptions = options.filter((option) => !isPinnedNativeOption(option));
  const orderedOptions = [
    ...pinnedOptions,
    ...sortByDropdownLabel(sortableOptions, (option) => option.textContent || ""),
  ];

  if (orderedOptions.every((option, index) => option === options[index])) return;

  orderedOptions.forEach((option) => select.appendChild(option));
}

export function observeNativeSelects(root: ParentNode = document): () => void {
  const sortAll = (container: ParentNode) => {
    if (container instanceof HTMLSelectElement) {
      sortNativeSelect(container);
    }
    container.querySelectorAll?.("select").forEach((select) => {
      sortNativeSelect(select);
    });
  };

  sortAll(root);

  const observer = new MutationObserver((mutations) => {
    const selects = new Set<HTMLSelectElement>();

    mutations.forEach((mutation) => {
      if (mutation.target instanceof HTMLSelectElement) {
        selects.add(mutation.target);
      }

      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLSelectElement) {
          selects.add(node);
        } else if (node instanceof Element) {
          node.querySelectorAll("select").forEach((select) => selects.add(select));
        }
      });
    });

    selects.forEach(sortNativeSelect);
  });

  const observerTarget =
    root instanceof Document ? root.documentElement : root;
  observer.observe(observerTarget, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export function getReactNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getReactNodeText).join("");
  if (React.isValidElement(node)) return getReactNodeText(node.props.children);
  return "";
}