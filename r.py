import os

# Директория для поиска и имя выходного файла
source_dir = 'src'
output_file = 'combined_code.txt'
allowed_extensions = ('.css', '.js')

# Открываем (или создаем) выходной файл для записи
# Используем with для автоматического закрытия файла
with open(output_file, 'w', encoding='utf-8') as outfile:
    # os.walk рекурсивно обходит все папки и файлы
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            # Проверяем, имеет ли файл нужное расширение
            if file.endswith(allowed_extensions):
                file_path = os.path.join(root, file)
                
                # Добавляем заголовок с путем к файлу
                outfile.write(f'--- Файл: {file_path} ---\n\n')
                
                try:
                    # Открываем и читаем содержимое исходного файла
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read())
                        outfile.write('\n\n') # Добавляем отступ между файлами
                except Exception as e:
                    # Если файл не удалось прочитать, записываем ошибку
                    outfile.write(f'*** Не удалось прочитать файл: {e} ***\n\n')

print(f'Все файлы были успешно объединены в {output_file}')