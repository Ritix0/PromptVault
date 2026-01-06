import os
import re

# Имя файла, из которого восстанавливаем
input_file = 'combined_code.txt'

def restore_files():
    if not os.path.exists(input_file):
        print(f"Ошибка: Файл '{input_file}' не найден.")
        return

    print(f"--- Начало восстановления из {input_file} ---")

    # Регулярное выражение для поиска заголовков
    # Ищет строки вида: --- Файл: путь/к/файлу.ext ---
    header_pattern = re.compile(r'^--- Файл: (.+) ---\s*$')

    current_file_path = None
    buffer = []

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except UnicodeDecodeError:
        print("Ошибка кодировки: попробуйте сохранить combined_code.txt в UTF-8.")
        return

    for line in lines:
        match = header_pattern.match(line)

        if match:
            # Если мы уже читали какой-то файл, сохраняем его перед началом нового
            if current_file_path:
                save_file_overwrite(current_file_path, buffer)
            
            # Получаем путь к новому файлу
            raw_path = match.group(1).strip()
            # Нормализуем путь (исправляем слеши под текущую ОС)
            current_file_path = os.path.normpath(raw_path)
            
            # Очищаем буфер для нового файла
            buffer = [] 
        else:
            # Если мы находимся внутри блока файла, сохраняем строку
            if current_file_path:
                buffer.append(line)

    # Сохраняем последний файл после окончания цикла
    if current_file_path:
        save_file_overwrite(current_file_path, buffer)

    print("\n--- Готово. Все файлы обработаны. ---")

def save_file_overwrite(path, content_lines):
    """
    Функция перезаписывает файл.
    """
    try:
        # 1. Убираем лишние пустые строки, добавленные скриптом объединения
        # Скрипт объединения добавляет \n\n ПОСЛЕ заголовка. Убираем первую пустую строку.
        if content_lines and content_lines[0].strip() == "":
            content_lines.pop(0)
        
        # Скрипт объединения добавляет \n\n ПОСЛЕ контента. Убираем пустые строки в конце.
        while content_lines and content_lines[-1].strip() == "":
            content_lines.pop()

        # 2. Проверяем, существует ли файл, чтобы вывести правильное сообщение
        if os.path.exists(path):
            status = "[ЗАМЕНЕН]"
        else:
            status = "[СОЗДАН ]"

        # 3. Создаем папки, если их нет
        os.makedirs(os.path.dirname(path), exist_ok=True)

        # 4. ПЕРЕЗАПИСЫВАЕМ файл (режим 'w' стирает старое содержимое)
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(content_lines)
            # Гарантируем, что файл заканчивается переносом строки (хороший тон)
            if content_lines and not content_lines[-1].endswith('\n'):
                f.write('\n')
        
        print(f"{status} {path}")

    except Exception as e:
        print(f"[ОШИБКА ] Не удалось записать {path}: {e}")

if __name__ == '__main__':
    restore_files()