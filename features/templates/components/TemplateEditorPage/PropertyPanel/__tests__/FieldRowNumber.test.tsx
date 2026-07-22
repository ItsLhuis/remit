// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { FieldRowNumber } from "../FieldRowNumber"

afterEach(() => {
  cleanup()
})

test("commits a plain typed number on blur", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={100} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "42" } })
  fireEvent.blur(input)

  expect(onChange).toHaveBeenCalledWith(42)
  expect(onChange).toHaveBeenCalledTimes(1)
})

test("does not commit while a relative expression is still being typed", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={100} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "+" } })
  fireEvent.change(input, { target: { value: "+1" } })

  expect(onChange).not.toHaveBeenCalled()
  expect(input).toHaveValue("+1")
})

test("commits a relative expression against the current value on blur", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={100} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "+10" } })
  fireEvent.blur(input)

  expect(onChange).toHaveBeenCalledWith(110)
})

test("commits an absolute expression on Enter", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={0} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  input.focus()
  fireEvent.change(input, { target: { value: "10*3-8" } })
  fireEvent.keyDown(input, { key: "Enter" })

  expect(onChange).toHaveBeenCalledWith(22)
})

test("reverts to the last committed value when garbage is typed and the field is blurred", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={100} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "abc" } })
  fireEvent.blur(input)

  expect(onChange).not.toHaveBeenCalled()
  expect(input).toHaveValue("100")
})

test("clamps a committed expression result to the field's max", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={0} max={50} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "240/2" } })
  fireEvent.blur(input)

  expect(onChange).toHaveBeenCalledWith(50)
})

test("commits immediately when the increment stepper is clicked", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={10} step={1} onChange={onChange} />)

  fireEvent.click(screen.getByLabelText("Increase"))

  expect(onChange).toHaveBeenCalledWith(11)
})

test("clears the field when it is blurred empty", () => {
  const onChange = vi.fn()

  render(<FieldRowNumber id="x" label="X" value={100} onChange={onChange} />)

  const input = screen.getByLabelText("X")

  fireEvent.change(input, { target: { value: "" } })
  fireEvent.blur(input)

  expect(onChange).toHaveBeenCalledWith(null)
})
