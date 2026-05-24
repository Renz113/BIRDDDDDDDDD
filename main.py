from __future__ import annotations

import random
from dataclasses import dataclass

import pygame

from storage import UserStorage


WIDTH = 480
HEIGHT = 720
GROUND_HEIGHT = 110
PIPE_WIDTH = 78
PIPE_GAP = 185
PIPE_SPEED = 4
BIRD_X = 120
FPS = 60

SKY_TOP = (129, 203, 255)
SKY_BOTTOM = (244, 251, 255)
PIPE_DARK = (41, 128, 76)
PIPE_LIGHT = (82, 176, 106)
GROUND = (225, 192, 132)
TEXT_DARK = (37, 44, 63)
PANEL = (255, 252, 243)
PANEL_BORDER = (223, 192, 133)
ACCENT = (245, 132, 31)
ACCENT_DARK = (198, 94, 6)
RED = (198, 64, 64)
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)
CLOUD = (255, 255, 255, 180)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


class InputBox:
    def __init__(self, rect: pygame.Rect, label: str, password: bool = False) -> None:
        self.rect = rect
        self.label = label
        self.password = password
        self.text = ""
        self.active = False
        self.cursor_on = True
        self.cursor_timer = 0

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.MOUSEBUTTONDOWN:
            self.active = self.rect.collidepoint(event.pos)
        elif event.type == pygame.KEYDOWN and self.active:
            if event.key == pygame.K_BACKSPACE:
                self.text = self.text[:-1]
            elif event.key not in (pygame.K_RETURN, pygame.K_TAB):
                if event.unicode.isprintable() and len(self.text) < 24:
                    self.text += event.unicode

    def update(self) -> None:
        self.cursor_timer = (self.cursor_timer + 1) % 60
        self.cursor_on = self.cursor_timer < 30

    def draw(self, surface: pygame.Surface, label_font: pygame.font.Font, input_font: pygame.font.Font) -> None:
        border = ACCENT if self.active else PANEL_BORDER
        pygame.draw.rect(surface, WHITE, self.rect, border_radius=14)
        pygame.draw.rect(surface, border, self.rect, width=3, border_radius=14)

        label_surf = label_font.render(self.label, True, TEXT_DARK)
        surface.blit(label_surf, (self.rect.x + 16, self.rect.y - 28))

        shown_text = "*" * len(self.text) if self.password else self.text
        if self.active and self.cursor_on:
            shown_text += "|"
        if not shown_text:
            shown_text = " " if self.active else ""
        text_surf = input_font.render(shown_text, True, BLACK)
        surface.blit(text_surf, (self.rect.x + 16, self.rect.y + 14))


class Button:
    def __init__(self, rect: pygame.Rect, label: str, fill: tuple[int, int, int], text_color: tuple[int, int, int] = WHITE) -> None:
        self.rect = rect
        self.label = label
        self.fill = fill
        self.text_color = text_color

    def was_clicked(self, event: pygame.event.Event) -> bool:
        return event.type == pygame.MOUSEBUTTONDOWN and self.rect.collidepoint(event.pos)

    def draw(self, surface: pygame.Surface, font: pygame.font.Font) -> None:
        hovered = self.rect.collidepoint(pygame.mouse.get_pos())
        fill = tuple(min(255, channel + 12) for channel in self.fill) if hovered else self.fill
        shadow_rect = self.rect.move(0, 4)
        pygame.draw.rect(surface, ACCENT_DARK if self.fill == ACCENT else (132, 150, 174), shadow_rect, border_radius=16)
        pygame.draw.rect(surface, fill, self.rect, border_radius=16)
        label_surf = font.render(self.label, True, self.text_color)
        surface.blit(label_surf, label_surf.get_rect(center=self.rect.center))


@dataclass
class Bird:
    x: float = BIRD_X
    y: float = HEIGHT / 2
    velocity: float = 0
    width: int = 40
    height: int = 30

    def flap(self) -> None:
        self.velocity = -9.2

    def update(self) -> None:
        self.velocity += 0.52
        self.velocity = clamp(self.velocity, -12, 12)
        self.y += self.velocity

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x - self.width / 2), int(self.y - self.height / 2), self.width, self.height)

    def draw(self, surface: pygame.Surface) -> None:
        angle = clamp(-self.velocity * 4, -28, 28)
        bird_surface = pygame.Surface((56, 44), pygame.SRCALPHA)
        pygame.draw.ellipse(bird_surface, (252, 221, 68), (8, 8, 34, 24))
        pygame.draw.ellipse(bird_surface, (246, 183, 39), (14, 18, 22, 14))
        pygame.draw.polygon(bird_surface, ACCENT, [(38, 20), (52, 16), (52, 26)])
        pygame.draw.circle(bird_surface, WHITE, (28, 16), 5)
        pygame.draw.circle(bird_surface, BLACK, (30, 16), 2)
        rotated = pygame.transform.rotate(bird_surface, angle)
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect)


@dataclass
class PipePair:
    x: float
    gap_y: int
    scored: bool = False

    def update(self) -> None:
        self.x -= PIPE_SPEED

    def collides(self, bird_rect: pygame.Rect) -> bool:
        top_rect = pygame.Rect(int(self.x), 0, PIPE_WIDTH, self.gap_y - PIPE_GAP // 2)
        bottom_y = self.gap_y + PIPE_GAP // 2
        bottom_rect = pygame.Rect(int(self.x), bottom_y, PIPE_WIDTH, HEIGHT - GROUND_HEIGHT - bottom_y)
        return bird_rect.colliderect(top_rect) or bird_rect.colliderect(bottom_rect)

    def off_screen(self) -> bool:
        return self.x + PIPE_WIDTH < 0

    def passed_bird(self, bird_x: float) -> bool:
        if not self.scored and self.x + PIPE_WIDTH < bird_x:
            self.scored = True
            return True
        return False

    def draw(self, surface: pygame.Surface) -> None:
        top_height = self.gap_y - PIPE_GAP // 2
        bottom_y = self.gap_y + PIPE_GAP // 2
        bottom_height = HEIGHT - GROUND_HEIGHT - bottom_y

        top_rect = pygame.Rect(int(self.x), 0, PIPE_WIDTH, top_height)
        bottom_rect = pygame.Rect(int(self.x), bottom_y, PIPE_WIDTH, bottom_height)

        for rect in (top_rect, bottom_rect):
            pygame.draw.rect(surface, PIPE_DARK, rect, border_radius=10)
            inner = rect.inflate(-12, 0)
            pygame.draw.rect(surface, PIPE_LIGHT, inner, border_radius=8)
            lip = pygame.Rect(rect.x - 6, rect.bottom - 20 if rect is top_rect else rect.y, PIPE_WIDTH + 12, 20)
            pygame.draw.rect(surface, PIPE_DARK, lip, border_radius=8)


class FlappyBirdApp:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption("Flappy Login Bird")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.storage = UserStorage()
        self.background_surface = self.build_background()

        self.title_font = pygame.font.SysFont("trebuchetms", 46, bold=True)
        self.big_font = pygame.font.SysFont("trebuchetms", 34, bold=True)
        self.medium_font = pygame.font.SysFont("trebuchetms", 26, bold=True)
        self.body_font = pygame.font.SysFont("trebuchetms", 22)
        self.small_font = pygame.font.SysFont("trebuchetms", 18)

        self.username_box = InputBox(pygame.Rect(110, 250, 260, 54), "Username")
        self.password_box = InputBox(pygame.Rect(110, 340, 260, 54), "Password", password=True)
        self.username_box.active = True

        self.submit_button = Button(pygame.Rect(110, 420, 260, 54), "Log In", ACCENT)
        self.toggle_button = Button(pygame.Rect(110, 490, 260, 46), "Need an account? Register", (85, 111, 147))
        self.start_button = Button(pygame.Rect(140, 420, 200, 58), "Start Game", ACCENT)
        self.logout_button = Button(pygame.Rect(140, 490, 200, 46), "Log Out", (85, 111, 147))
        self.retry_button = Button(pygame.Rect(140, 450, 200, 52), "Play Again", ACCENT)
        self.menu_button = Button(pygame.Rect(140, 515, 200, 46), "Back To Menu", (85, 111, 147))

        self.auth_mode = "login"
        self.state = "auth"
        self.message = "Create an account or log in to start playing."
        self.message_color = TEXT_DARK
        self.current_user_key: str | None = None
        self.current_profile: dict | None = None
        self.leaderboard = self.storage.get_leaderboard()

        self.bird = Bird()
        self.pipes: list[PipePair] = []
        self.spawn_timer = 0
        self.score = 0
        self.floor_offset = 0
        self.cloud_offset = 0
        self.running = True

    def build_background(self) -> pygame.Surface:
        surface = pygame.Surface((WIDTH, HEIGHT))
        for y in range(HEIGHT):
            ratio = y / HEIGHT
            color = (
                int(SKY_TOP[0] * (1 - ratio) + SKY_BOTTOM[0] * ratio),
                int(SKY_TOP[1] * (1 - ratio) + SKY_BOTTOM[1] * ratio),
                int(SKY_TOP[2] * (1 - ratio) + SKY_BOTTOM[2] * ratio),
            )
            pygame.draw.line(surface, color, (0, y), (WIDTH, y))
        return surface

    def set_message(self, text: str, color: tuple[int, int, int] = TEXT_DARK) -> None:
        self.message = text
        self.message_color = color

    def refresh_profile(self) -> None:
        if self.current_user_key:
            self.current_profile = self.storage.get_profile(self.current_user_key)
        else:
            self.current_profile = None
        self.leaderboard = self.storage.get_leaderboard()

    def switch_auth_mode(self) -> None:
        self.auth_mode = "register" if self.auth_mode == "login" else "login"
        self.submit_button.label = "Create Account" if self.auth_mode == "register" else "Log In"
        self.toggle_button.label = "Have an account? Log In" if self.auth_mode == "register" else "Need an account? Register"
        self.set_message("Use Tab to switch fields and Enter to submit.")

    def submit_auth(self) -> None:
        username = self.username_box.text
        password = self.password_box.text

        if self.auth_mode == "register":
            success, message, user_key = self.storage.register_user(username, password)
        else:
            success, message, user_key = self.storage.authenticate_user(username, password)

        if success and user_key:
            self.current_user_key = user_key
            self.password_box.text = ""
            self.refresh_profile()
            self.state = "menu"
            self.set_message(message, (45, 132, 78))
        else:
            self.set_message(message, RED)

    def logout(self) -> None:
        self.current_user_key = None
        self.current_profile = None
        self.state = "auth"
        self.username_box.text = ""
        self.password_box.text = ""
        self.username_box.active = True
        self.password_box.active = False
        self.set_message("Logged out. You can sign in with another player.")

    def start_game(self) -> None:
        self.state = "playing"
        self.bird = Bird()
        self.pipes = []
        self.spawn_timer = 0
        self.score = 0
        self.set_message("Tap Space or click to flap.")

    def finish_game(self) -> None:
        self.state = "game_over"
        if self.current_user_key:
            self.current_profile = self.storage.update_score(self.current_user_key, self.score)
        self.leaderboard = self.storage.get_leaderboard()
        best = 0 if not self.current_profile else int(self.current_profile.get("best_score", 0))
        self.set_message(f"Round finished. Score: {self.score} | Best: {best}")

    def handle_auth_event(self, event: pygame.event.Event) -> None:
        self.username_box.handle_event(event)
        self.password_box.handle_event(event)

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_TAB:
                self.focus_next_auth_field()
            elif event.key == pygame.K_RETURN:
                self.submit_auth()
        elif self.submit_button.was_clicked(event):
            self.submit_auth()
        elif self.toggle_button.was_clicked(event):
            self.switch_auth_mode()

    def focus_next_auth_field(self) -> None:
        if self.username_box.active:
            self.username_box.active = False
            self.password_box.active = True
        else:
            self.username_box.active = True
            self.password_box.active = False

    def handle_menu_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN and event.key in (pygame.K_SPACE, pygame.K_RETURN):
            self.start_game()
        elif self.start_button.was_clicked(event):
            self.start_game()
        elif self.logout_button.was_clicked(event):
            self.logout()

    def handle_play_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            self.bird.flap()
        elif event.type == pygame.MOUSEBUTTONDOWN:
            self.bird.flap()

    def handle_game_over_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                self.start_game()
            elif event.key == pygame.K_ESCAPE:
                self.state = "menu"
        elif self.retry_button.was_clicked(event):
            self.start_game()
        elif self.menu_button.was_clicked(event):
            self.state = "menu"

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                continue

            if self.state == "auth":
                self.handle_auth_event(event)
            elif self.state == "menu":
                self.handle_menu_event(event)
            elif self.state == "playing":
                self.handle_play_event(event)
            elif self.state == "game_over":
                self.handle_game_over_event(event)

    def spawn_pipe(self) -> None:
        gap_y = random.randint(180, HEIGHT - GROUND_HEIGHT - 180)
        self.pipes.append(PipePair(WIDTH + 10, gap_y))

    def update_game(self) -> None:
        self.floor_offset = (self.floor_offset + PIPE_SPEED) % 32
        self.cloud_offset = (self.cloud_offset + 1) % WIDTH

        if self.state == "auth":
            self.username_box.update()
            self.password_box.update()
            return

        if self.state != "playing":
            return

        self.spawn_timer += 1
        if self.spawn_timer >= 90:
            self.spawn_timer = 0
            self.spawn_pipe()

        self.bird.update()
        if self.bird.y - self.bird.height / 2 <= 0 or self.bird.y + self.bird.height / 2 >= HEIGHT - GROUND_HEIGHT:
            self.finish_game()
            return

        for pipe in list(self.pipes):
            pipe.update()
            if pipe.collides(self.bird.rect):
                self.finish_game()
                return
            if pipe.passed_bird(self.bird.x):
                self.score += 1
            if pipe.off_screen():
                self.pipes.remove(pipe)

    def draw_background(self) -> None:
        self.screen.blit(self.background_surface, (0, 0))

        cloud_positions = [
            (80 - self.cloud_offset * 0.4, 115, 76, 32),
            (260 - self.cloud_offset * 0.25, 170, 92, 36),
            (420 - self.cloud_offset * 0.35, 90, 84, 34),
            (WIDTH + 120 - self.cloud_offset * 0.5, 135, 88, 34),
        ]

        for x, y, w, h in cloud_positions:
            wrapped_x = int(x % (WIDTH + 220)) - 110
            cloud_surface = pygame.Surface((w + 30, h + 20), pygame.SRCALPHA)
            pygame.draw.ellipse(cloud_surface, CLOUD, (0, 6, w // 2, h))
            pygame.draw.ellipse(cloud_surface, CLOUD, (w // 4, 0, w // 2, h + 8))
            pygame.draw.ellipse(cloud_surface, CLOUD, (w // 2, 6, w // 2, h))
            self.screen.blit(cloud_surface, (wrapped_x, y))

    def draw_ground(self) -> None:
        ground_rect = pygame.Rect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT)
        pygame.draw.rect(self.screen, GROUND, ground_rect)
        pygame.draw.rect(self.screen, (201, 164, 96), (0, HEIGHT - GROUND_HEIGHT, WIDTH, 14))

        for i in range(-1, WIDTH // 32 + 2):
            x = i * 32 - self.floor_offset
            pygame.draw.line(self.screen, (189, 148, 84), (x, HEIGHT - 58), (x + 20, HEIGHT - 42), 3)
            pygame.draw.line(self.screen, (238, 208, 146), (x + 12, HEIGHT - 28), (x + 28, HEIGHT - 12), 2)

    def draw_panel(self, rect: pygame.Rect) -> None:
        pygame.draw.rect(self.screen, PANEL, rect, border_radius=24)
        pygame.draw.rect(self.screen, PANEL_BORDER, rect, width=4, border_radius=24)

    def draw_auth(self) -> None:
        panel = pygame.Rect(50, 120, 380, 470)
        self.draw_panel(panel)

        title = "Register" if self.auth_mode == "register" else "Log In"
        subtitle = "Flappy Bird with saved scores"

        title_surf = self.title_font.render(title, True, TEXT_DARK)
        subtitle_surf = self.small_font.render(subtitle, True, (83, 95, 120))
        self.screen.blit(title_surf, title_surf.get_rect(center=(WIDTH // 2, 175)))
        self.screen.blit(subtitle_surf, subtitle_surf.get_rect(center=(WIDTH // 2, 210)))

        self.username_box.draw(self.screen, self.small_font, self.body_font)
        self.password_box.draw(self.screen, self.small_font, self.body_font)
        self.submit_button.draw(self.screen, self.body_font)
        self.toggle_button.draw(self.screen, self.small_font)

        hint = self.small_font.render("Tip: use Tab to move between fields.", True, (108, 116, 134))
        message = self.small_font.render(self.message, True, self.message_color)
        self.screen.blit(hint, hint.get_rect(center=(WIDTH // 2, 570)))
        self.screen.blit(message, message.get_rect(center=(WIDTH // 2, 605)))

    def draw_menu(self) -> None:
        panel = pygame.Rect(55, 90, 370, 530)
        self.draw_panel(panel)

        name = "Player"
        best_score = 0
        if self.current_profile:
            name = self.current_profile.get("display_name", "Player")
            best_score = int(self.current_profile.get("best_score", 0))

        title = self.title_font.render("Flappy Bird", True, TEXT_DARK)
        hello = self.medium_font.render(f"Welcome, {name}", True, (78, 98, 130))
        best = self.body_font.render(f"Best score: {best_score}", True, TEXT_DARK)
        tip = self.small_font.render("Press Enter/Space or use the button to fly.", True, (105, 117, 139))

        self.screen.blit(title, title.get_rect(center=(WIDTH // 2, 150)))
        self.screen.blit(hello, hello.get_rect(center=(WIDTH // 2, 195)))
        self.screen.blit(best, best.get_rect(center=(WIDTH // 2, 230)))
        self.screen.blit(tip, tip.get_rect(center=(WIDTH // 2, 260)))

        self.start_button.draw(self.screen, self.body_font)
        self.logout_button.draw(self.screen, self.small_font)

        leaderboard_title = self.medium_font.render("Top Pilots", True, TEXT_DARK)
        self.screen.blit(leaderboard_title, (140, 305))

        leaderboard_panel = pygame.Rect(100, 350, 280, 145)
        pygame.draw.rect(self.screen, WHITE, leaderboard_panel, border_radius=16)
        pygame.draw.rect(self.screen, PANEL_BORDER, leaderboard_panel, width=2, border_radius=16)

        if self.leaderboard:
            for index, user in enumerate(self.leaderboard[:5], start=1):
                label = f"{index}. {user['display_name']}"
                score = str(user.get("best_score", 0))
                name_surf = self.body_font.render(label, True, TEXT_DARK)
                score_surf = self.body_font.render(score, True, ACCENT_DARK)
                y = 365 + (index - 1) * 26
                self.screen.blit(name_surf, (118, y))
                self.screen.blit(score_surf, score_surf.get_rect(topright=(360, y)))
        else:
            empty = self.body_font.render("No scores yet. Be the first.", True, (108, 116, 134))
            self.screen.blit(empty, empty.get_rect(center=leaderboard_panel.center))

        message = self.small_font.render(self.message, True, self.message_color)
        self.screen.blit(message, message.get_rect(center=(WIDTH // 2, 585)))

    def draw_playing(self) -> None:
        for pipe in self.pipes:
            pipe.draw(self.screen)
        self.bird.draw(self.screen)

        score_panel = pygame.Rect(18, 18, 120, 52)
        pygame.draw.rect(self.screen, (255, 252, 243, 230), score_panel, border_radius=16)
        pygame.draw.rect(self.screen, PANEL_BORDER, score_panel, width=2, border_radius=16)

        label = self.small_font.render("SCORE", True, (116, 120, 130))
        score_surf = self.big_font.render(str(self.score), True, TEXT_DARK)
        self.screen.blit(label, (34, 24))
        self.screen.blit(score_surf, (34, 38))

        hint = self.small_font.render("Space or click to flap", True, (96, 108, 130))
        self.screen.blit(hint, hint.get_rect(topright=(WIDTH - 18, 24)))

    def draw_game_over(self) -> None:
        for pipe in self.pipes:
            pipe.draw(self.screen)
        self.bird.draw(self.screen)

        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((255, 246, 232, 120))
        self.screen.blit(overlay, (0, 0))

        panel = pygame.Rect(70, 150, 340, 450)
        self.draw_panel(panel)

        title = self.big_font.render("Round Over", True, TEXT_DARK)
        score = self.medium_font.render(f"Score: {self.score}", True, ACCENT_DARK)
        best_score = 0 if not self.current_profile else int(self.current_profile.get("best_score", 0))
        best = self.body_font.render(f"Personal best: {best_score}", True, TEXT_DARK)
        message = self.small_font.render("Press Enter/Space to try again.", True, (101, 115, 138))

        self.screen.blit(title, title.get_rect(center=(WIDTH // 2, 215)))
        self.screen.blit(score, score.get_rect(center=(WIDTH // 2, 265)))
        self.screen.blit(best, best.get_rect(center=(WIDTH // 2, 300)))
        self.screen.blit(message, message.get_rect(center=(WIDTH // 2, 335)))

        self.retry_button.draw(self.screen, self.body_font)
        self.menu_button.draw(self.screen, self.small_font)

        leaderboard_title = self.medium_font.render("Leaderboard", True, TEXT_DARK)
        self.screen.blit(leaderboard_title, (145, 385))

        for index, user in enumerate(self.leaderboard[:3], start=1):
            line = f"{index}. {user['display_name']} - {user.get('best_score', 0)}"
            line_surf = self.body_font.render(line, True, (75, 89, 114))
            self.screen.blit(line_surf, line_surf.get_rect(center=(WIDTH // 2, 410 + index * 30)))

    def draw(self) -> None:
        self.draw_background()

        if self.state == "auth":
            self.draw_auth()
        elif self.state == "menu":
            self.draw_menu()
        elif self.state == "playing":
            self.draw_playing()
        elif self.state == "game_over":
            self.draw_game_over()

        self.draw_ground()
        pygame.display.flip()

    def run(self) -> None:
        while self.running:
            self.handle_events()
            self.update_game()
            self.draw()
            self.clock.tick(FPS)
        pygame.quit()


if __name__ == "__main__":
    FlappyBirdApp().run()
