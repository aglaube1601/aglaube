/**
 * update-foto-perfil.dto.ts
 */

import { IsString, MaxLength, Matches } from 'class-validator';

export class UpdateFotoPerfilDto {
  // Data URL (base64) já redimensionada no navegador antes do envio (ver
  // JornalComposer.tsx) — string vazia remove a foto. O limite de tamanho
  // é uma rede de segurança generosa (uma foto de ~700px de largura em
  // JPEG fica bem abaixo disso), não um valor calibrado com precisão.
  @IsString()
  @MaxLength(2_000_000, { message: 'Imagem grande demais.' })
  @Matches(/^$|^data:image\/(png|jpe?g|webp);base64,/, {
    message: 'Formato de imagem inválido.',
  })
  fotoPerfilUrl: string;
}
