import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactForm } from "@/components/views/ContactForm";

const { mutateBackendDataMock } = vi.hoisted(() => ({ mutateBackendDataMock: vi.fn() }));
vi.mock("@/lib/backend-client", () => ({ mutateBackendData: mutateBackendDataMock }));

afterEach(() => cleanup());

beforeEach(() => {
    mutateBackendDataMock.mockReset();
    mutateBackendDataMock.mockResolvedValue({ ok: true });
});

function fillValidForm() {
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Amina Okafor" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "amina@example.com" } });
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "Buyer support" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Please help with my order." } });
}

describe("ContactForm", () => {
    it("submits the contact enquiry and shows the success state", async () => {
        render(<ContactForm />);
        fillValidForm();

        fireEvent.click(screen.getByRole("button", { name: /send message/i }));

        await waitFor(() => {
            expect(mutateBackendDataMock).toHaveBeenCalledWith("send-contact", {
                name: "Amina Okafor",
                email: "amina@example.com",
                subject: "Buyer support",
                message: "Please help with my order."
            });
        });
        await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Message sent"));
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows the backend error message when submission fails", async () => {
        mutateBackendDataMock.mockRejectedValueOnce(new Error("Contact service unavailable"));
        render(<ContactForm />);
        fillValidForm();

        fireEvent.click(screen.getByRole("button", { name: /send message/i }));

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("Contact service unavailable");
        expect(screen.getByRole("button", { name: /send message/i })).toBeTruthy();
    });
});
