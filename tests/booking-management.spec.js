import { test, expect } from '@playwright/test';

const USER_EMAIL = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

async function login(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn, button:has-text("Sign In")').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

async function clearBookings(page) {
  await page.goto('/bookings');
  if (await page.getByText('No bookings yet').isVisible().catch(() => false)) return;

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

async function bookFirstAvailableEvent(page, quantity = 1) {
  await page.goto('/events');
  const card = page.getByTestId('event-card').filter({ has: page.getByTestId('book-now-btn') }).first();
  await expect(card).toBeVisible();
  const eventTitle = (await card.locator('h3').textContent()).trim();
  await card.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  for (let index = 1; index < quantity; index += 1) {
    await page.getByRole('button', { name: '+' }).click();
  }
  await page.getByLabel('Full Name').fill('Test User');
  await page.locator('#customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('.confirm-booking-btn').click();

  const bookingRef = page.locator('.booking-ref').first();
  await expect(bookingRef).toBeVisible();
  return { eventTitle, bookingRef: (await bookingRef.textContent()).trim() };
}

test.describe('Booking management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await clearBookings(page);
  });

  test('shows booking details from the bookings list', async ({ page }) => {
    const { eventTitle, bookingRef } = await bookFirstAvailableEvent(page);
    await page.goto('/bookings');

    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');

    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    await expect(page.locator('span.font-mono.font-bold').first()).toContainText(bookingRef);
    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.locator('#check-refund-btn')).toBeVisible();
  });

  test('cancels a booking after confirmation', async ({ page }) => {
    const { bookingRef } = await bookFirstAvailableEvent(page);
    await page.goto('/bookings');
    await page.getByTestId('booking-card').filter({ hasText: bookingRef }).getByRole('link', { name: 'View Details' }).click();

    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    const confirmCancellation = page.getByRole('button', { name: 'Yes, cancel it' });
    await expect(confirmCancellation).toBeEnabled();
    await confirmCancellation.evaluate(button => button.click());

    await expect(page).toHaveURL(/\/bookings$/);
    await page.reload();
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

  test('clears all bookings and returns to the empty state', async ({ page }) => {
    await bookFirstAvailableEvent(page);
    await page.goto('/bookings');
    await expect(page.getByTestId('booking-card').first()).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /clear all bookings/i }).click();
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse Events' })).toBeVisible();
  });

  test('generates a reference with the event title prefix', async ({ page }) => {
    const { eventTitle, bookingRef } = await bookFirstAvailableEvent(page);
    expect(bookingRef).toMatch(new RegExp(`^${eventTitle[0].toUpperCase()}-[A-Z0-9]{6}$`));
  });
});
