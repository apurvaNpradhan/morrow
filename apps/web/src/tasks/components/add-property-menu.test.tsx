import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { AddPropertyMenu } from "./add-property-menu";

afterEach(cleanup);

it("renders nothing when every property has a value", () => {
  const { container } = render(
    <AddPropertyMenu properties={[]} onAdd={vi.fn()} />,
  );
  expect(container.firstChild).toBeNull();
});

it("lists the unset properties and reports the one chosen", async () => {
  const onAdd = vi.fn();
  render(
    <AddPropertyMenu
      properties={[
        { sheetField: "dueDate", label: "Due date" },
        { sheetField: "field:f1", label: "Size" },
      ]}
      onAdd={onAdd}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "sheet.addProperty" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Size" }));

  expect(onAdd).toHaveBeenCalledWith("field:f1");
  expect(screen.queryByRole("menuitem", { name: "Due date" })).toBeNull();
});
